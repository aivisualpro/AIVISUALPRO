import express from "express";
import fs from "fs";
import path from "path";
import "dotenv/config";

const app = express();
app.use(express.json());

// dynamic loader
const scriptsPath = path.join(process.cwd(), "scripts");

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
