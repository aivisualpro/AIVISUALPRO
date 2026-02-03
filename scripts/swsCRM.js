import fs from "fs";
import path from "path";

export default async function (data) {
    const clientsDir = path.join(process.cwd(), "clients");
    const dataFile = path.join(clientsDir, "swsCRM_data.json");

    if (!fs.existsSync(clientsDir)) {
        fs.mkdirSync(clientsDir, { recursive: true });
    }

    // Save the incoming data to the JSON file
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

    console.log("swsCRM data updated successfully.");
    return { message: "Data received and saved", timestamp: new Date().toISOString() };
}
