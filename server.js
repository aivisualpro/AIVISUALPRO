import express from "express";
import fs from "fs";
import path from "path";
import "dotenv/config";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// dynamic loader
const scriptsPath = path.join(process.cwd(), "scripts");
app.use(express.static(path.join(process.cwd(), "clients")));
app.use("/clients", express.static(path.join(process.cwd(), "clients")));
// serve file-based "database" (txt docs) as static files
// app.use("/Database", express.static(path.join(process.cwd(), "Database")));


// webhook handler - each file becomes a webhook
app.post("/webhook/:script", async (req, res) => {
    try {
        const scriptName = req.params.script;
        const scriptFile = path.join(scriptsPath, `${scriptName}.js`);

        if (!fs.existsSync(scriptFile)) {
            return res.status(404).json({ error: "Script not found" });
        }

        const script = await import(scriptFile);

        if (!script.default) {
            return res.status(500).json({ error: "Script file missing default export" });
        }

        const result = await script.default(req.body);

        return res.json({ success: true, result });

    } catch (err) {
        console.error("WEBHOOK ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

// healthcheck
app.get("/", (req, res) => res.send("Node Webhook Server Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));