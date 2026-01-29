const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');       
const jwt = require('jsonwebtoken');      
const cookieParser = require('cookie-parser'); 

const app = express();
const PORT = 3000;
const SECRET_KEY = "buildmaster_secret_key_change_this_in_prod"; 

// --- MULTER SETUP ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){ fs.mkdirSync(uploadDir, { recursive: true }); }

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'public/uploads/') },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'emp-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- DATABASE ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("DB Error:", err.message);
    else console.log('Connected to the BuildMaster database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, price REAL, stock INTEGER, unit TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, items TEXT, total REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, user TEXT, timestamp TEXT, metadata TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS positions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT, lname TEXT, fname TEXT, mname TEXT, addr_brgy TEXT, addr_city TEXT, addr_prov TEXT,
        philhealth TEXT, pagibig TEXT, sss TEXT, mobile TEXT, email TEXT, civil_status TEXT, dob TEXT, dept_id INTEGER, pos_id INTEGER, photo TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, permissions TEXT, employee_id INTEGER)`);

    // Seeds
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?)");
            const defaults = [["[SAMPLE] Portland Cement", "Structural", 280.00, 150, "Piece(s)"], ["[SAMPLE] Steel Bar 10mm", "Structural", 185.00, 500, "Piece(s)"]];
            defaults.forEach(d => stmt.run(d));
            stmt.finalize();
        }
    });

    // SECURE ADMIN SEED
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (row.count === 0) {
            const allPerms = JSON.stringify(['dashboard', 'inventory', 'pos', 'reports', 'activity', 'employees', 'can_void']);
            const hashedPassword = await bcrypt.hash('admin123', 10); 
            db.run("INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)", ['admin', hashedPassword, allPerms]);
            console.log("Default Admin created (Pass: admin123)");
        }
    });
});

// --- LOGGING HELPER ---
function logActivity(action, details, metadata = null, user = "System") {
    const timestamp = new Date().toLocaleString();
    const metaString = metadata ? JSON.stringify(metadata) : null;
    db.run("INSERT INTO activity_logs (action, details, user, timestamp, metadata) VALUES (?, ?, ?, ?, ?)",
        [action, details, user, timestamp, metaString], (err) => { if (err) console.error(err); });
}

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: "User not found" });
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Invalid password" });
        const token = jwt.sign({ id: user.id, username: user.username, permissions: user.permissions }, SECRET_KEY, { expiresIn: '8h' });
        res.cookie('auth_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
        res.json({ success: true, username: user.username, permissions: JSON.parse(user.permissions) });
    });
});
app.post('/api/logout', (req, res) => { res.clearCookie('auth_token'); res.json({ success: true }); });
app.get('/api/check-auth', authenticateToken, (req, res) => {
    let perms = req.user.permissions;
    if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch (e) { perms = []; } }
    res.json({ username: req.user.username, permissions: perms });
});
app.post('/api/verify-supervisor', async (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: "User not found" });
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Invalid password" });
        const perms = JSON.parse(user.permissions || "[]");
        if (!perms.includes('can_void')) return res.status(403).json({ error: "User is not authorized to approve voids." });
        res.json({ success: true });
    });
});

// --- INVENTORY ROUTES ---
app.get('/api/inventory', authenticateToken, (req, res) => { db.all("SELECT * FROM products ORDER BY id DESC", [], (err, rows) => { res.json(rows); }); });
app.post('/api/inventory', authenticateToken, (req, res) => {
    const { name, category, price, stock, unit } = req.body;
    db.run(`INSERT INTO products (name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?)`, [name, category, price, stock, unit], function(err) {
        logActivity("Add Item", `Added: ${name}`, req.body, req.user.username);
        res.json({ id: this.lastID });
    });
});
app.delete('/api/inventory/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
        db.run("DELETE FROM products WHERE id = ?", id, function(err) {
            logActivity("Delete Item", `Deleted: ${row ? row.name : id}`, row, req.user.username);
            res.json({ message: "Deleted" });
        });
    });
});
app.put('/api/inventory/:id', authenticateToken, (req, res) => {
    const { name, category, price, stock, unit } = req.body;
    db.run(`UPDATE products SET name=?, category=?, price=?, stock=?, unit=? WHERE id=?`, [name, category, price, stock, unit, req.params.id], function(err) {
        logActivity("Update Item", `Updated Item #${req.params.id}`, req.body, req.user.username);
        res.json({ message: "Updated" });
    });
});

// --- SALES ROUTES ---
app.post('/api/checkout', authenticateToken, (req, res) => {
    const { cart, total } = req.body;
    const date = new Date().toLocaleString();
    db.run("INSERT INTO sales (date, items, total) VALUES (?, ?, ?)", [date, JSON.stringify(cart), total], function(err) {
        const saleId = this.lastID;
        cart.forEach(item => db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [item.qty, item.id]));
        logActivity("Sale", `Sale #${saleId}`, { items: cart, total: total, id: saleId }, req.user.username);
        res.json({ success: true, saleId, date });
    });
});

// VOID TRANSACTION
app.post('/api/sales/:id/void', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { approvedBy } = req.body; // <--- NEW: Capture the supervisor's name

    db.get("SELECT * FROM sales WHERE id = ?", [id], (err, sale) => {
        if(!sale) return res.status(404).json({error: "Not found"});
        try {
            const items = JSON.parse(sale.items);
            // Restore stock
            items.forEach(item => db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [item.qty, item.id]));
            
            // Delete sale and Log with Supervisor info
            db.run("DELETE FROM sales WHERE id = ?", [id], () => {
                logActivity(
                    "Void Transaction", 
                    `Voided Sale #${id}`, 
                    { 
                        items: items, 
                        total: sale.total, 
                        id: id, 
                        approvedBy: approvedBy || "Unknown" // <--- NEW: Store in metadata
                    }, 
                    req.user.username // The user currently logged in (Cashier)
                );
                res.json({ message: "Voided" });
            });
        } catch(e) { res.status(500).json({error: "Parse error"}); }
    });
});

app.get('/api/sales', authenticateToken, (req, res) => { db.all("SELECT * FROM sales ORDER BY id DESC", [], (err, rows) => { res.json(rows.map(r => ({...r, details: JSON.parse(r.items), itemsSummary: JSON.parse(r.items).map(i=>`${i.name} (x${i.qty})`).join(', ')}))); }); });
app.get('/api/logs', authenticateToken, (req, res) => { db.all("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 100", [], (err, rows) => { res.json(rows); }); });

// --- EMPLOYEE ROUTES ---
app.get('/api/employees', authenticateToken, (req, res) => {
    const sql = `SELECT e.*, d.name as dept_name, p.name as pos_name FROM employees e LEFT JOIN departments d ON e.dept_id = d.id LEFT JOIN positions p ON e.pos_id = p.id ORDER BY e.lname ASC`;
    db.all(sql, [], (err, rows) => { res.json(rows); });
});
app.post('/api/employees', authenticateToken, upload.single('photo'), (req, res) => {
    const { lname, fname } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = `INSERT INTO employees (lname, fname, mname, addr_brgy, addr_city, addr_prov, philhealth, pagibig, sss, mobile, email, civil_status, dob, dept_id, pos_id, photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [lname, fname, req.body.mname, req.body.addr_brgy, req.body.addr_city, req.body.addr_prov, req.body.philhealth, req.body.pagibig, req.body.sss, req.body.mobile, req.body.email, req.body.civil_status, req.body.dob, req.body.dept_id, req.body.pos_id, photo];
    
    db.run(sql, params, function(err) {
        if(err) return res.status(500).json({error: err.message});
        logActivity("Add Employee", `Added ${lname}, ${fname}`, { ...req.body, photo: photo }, req.user.username);
        res.json({id: this.lastID});
    });
});
app.put('/api/employees/:id', authenticateToken, upload.single('photo'), (req, res) => {
    const id = req.params.id;
    let sql = `UPDATE employees SET lname=?, fname=?, mname=?, addr_brgy=?, addr_city=?, addr_prov=?, philhealth=?, pagibig=?, sss=?, mobile=?, email=?, civil_status=?, dob=?, dept_id=?, pos_id=?`;
    let params = [req.body.lname, req.body.fname, req.body.mname, req.body.addr_brgy, req.body.addr_city, req.body.addr_prov, req.body.philhealth, req.body.pagibig, req.body.sss, req.body.mobile, req.body.email, req.body.civil_status, req.body.dob, req.body.dept_id, req.body.pos_id];
    if (req.file) { sql += `, photo=?`; params.push(`/uploads/${req.file.filename}`); }
    sql += ` WHERE id=?`; params.push(id);

    db.run(sql, params, function(err) {
        logActivity("Update Employee", `Updated Employee #${id}`, req.body, req.user.username);
        res.json({message: "Updated"});
    });
});
app.delete('/api/employees/:id', authenticateToken, (req, res) => { 
    const id = req.params.id;
    db.get("SELECT * FROM employees WHERE id = ?", [id], (err, row) => {
        db.run("DELETE FROM employees WHERE id=?", id, () => {
            logActivity("Delete Employee", `Deleted Employee #${id}`, row, req.user.username);
            res.json({message:"Deleted"});
        }); 
    });
});

// --- ORG ROUTES ---
app.get('/api/departments', authenticateToken, (req, res) => { db.all("SELECT * FROM departments", [], (err, rows) => res.json(rows)); });
app.post('/api/departments', authenticateToken, (req, res) => {
    db.run("INSERT INTO departments (name) VALUES (?)", [req.body.name], function(err) {
        logActivity("Add Department", `Added Dept: ${req.body.name}`, req.body, req.user.username);
        res.json({id: this.lastID});
    });
});
app.delete('/api/departments/:id', authenticateToken, (req, res) => { 
    db.get("SELECT name FROM departments WHERE id=?", [req.params.id], (err, row) => {
        db.run("DELETE FROM departments WHERE id=?", req.params.id, ()=> {
            logActivity("Delete Department", `Deleted Dept: ${row ? row.name : ''}`, row, req.user.username);
            res.json({message:"Deleted"});
        }); 
    });
});

app.get('/api/positions', authenticateToken, (req, res) => { db.all("SELECT * FROM positions", [], (err, rows) => res.json(rows)); });
app.post('/api/positions', authenticateToken, (req, res) => {
    db.run("INSERT INTO positions (name) VALUES (?)", [req.body.name], function(err) {
        logActivity("Add Position", `Added Position: ${req.body.name}`, req.body, req.user.username);
        res.json({id: this.lastID});
    });
});
app.delete('/api/positions/:id', authenticateToken, (req, res) => { 
    db.get("SELECT name FROM positions WHERE id=?", [req.params.id], (err, row) => {
        db.run("DELETE FROM positions WHERE id=?", req.params.id, ()=> {
            logActivity("Delete Position", `Deleted Pos: ${row ? row.name : ''}`, row, req.user.username);
            res.json({message:"Deleted"});
        }); 
    });
});

// --- USER ROUTES ---
app.get('/api/users', authenticateToken, (req, res) => {
    db.all("SELECT id, username, permissions, employee_id FROM users", [], (err, rows) => {
        if(err) return res.status(500).json({error: err.message});
        const users = rows.map(u => ({ ...u, permissions: JSON.parse(u.permissions) }));
        res.json(users);
    });
});

app.post('/api/users', authenticateToken, async (req, res) => {
    const { username, password, permissions, employee_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, permissions, employee_id) VALUES (?, ?, ?, ?)", 
        [username, hashedPassword, JSON.stringify(permissions), employee_id || null], 
        function(err) {
            if (err) return res.status(500).json({ error: "Username taken or DB error" });
            logActivity("Add User", `Created user: ${username}`, { username, permissions, employee_id }, req.user.username);
            res.json({ id: this.lastID });
    });
});

// NEW: Update User Route (PUT)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const { username, password, permissions, employee_id } = req.body;
    const id = req.params.id;

    let sql = "UPDATE users SET username=?, permissions=?, employee_id=?";
    let params = [username, JSON.stringify(permissions), employee_id || null];

    // Only update password if a new one is provided
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        sql += ", password=?";
        params.push(hashedPassword);
    }

    sql += " WHERE id=?";
    params.push(id);

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logActivity("Update User", `Updated user: ${username}`, { username, permissions, employee_id }, req.user.username);
        res.json({ message: "User updated" });
    });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => { 
    db.get("SELECT username FROM users WHERE id=?", [req.params.id], (err, row) => {
        db.run("DELETE FROM users WHERE id=?", req.params.id, ()=> {
            logActivity("Delete User", `Deleted User: ${row ? row.username : ''}`, row, req.user.username);
            res.json({message:"Deleted"});
        });
    });
});


app.listen(PORT, () => { console.log(`System running at http://localhost:${PORT}`); });