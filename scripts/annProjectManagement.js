import { google } from 'googleapis';
import 'dotenv/config';

// === CONFIG ===
const APP_ID = process.env.ANNAPPSHEET_APP_ID;
const ACCESS_KEY = process.env.ANNAPPSHEET_ACCESS;
const PARENT_FOLDER_ID = '1lJXoCeB6sHdPLTZrR7T7ehBaFn4NnIL3';
const TABLE_NAME = 'Projects';

// =========================================
// MAIN ENTRYPOINT
// =========================================
export default async function annProjectManagement(payload) {
    console.log("annProjectManagement received:", JSON.stringify(payload));
    const { projectName } = payload;

    if (!projectName) {
        return { error: "Missing projectName in payload" };
    }

    try {
        // 1. Auth Google
        const auth = await getAuth();
        const drive = google.drive({ version: 'v3', auth });

        // 2. Create Folder
        const folder = await createFolder(drive, projectName, PARENT_FOLDER_ID);
        const folderLink = `https://drive.google.com/drive/folders/${folder.id}`;
        console.log(`Created folder: ${projectName} (${folder.id})`);

        // 3. Update AppSheet
        const appSheetResult = await addToAppSheet(projectName, folderLink);
        console.log("AppSheet result:", JSON.stringify(appSheetResult));

        return {
            success: true,
            folderId: folder.id,
            folderLink,
            appSheetResult
        };

    } catch (error) {
        console.error("annProjectManagement Error:", error);
        return { error: error.message };
    }
}

// =========================================
// GOOGLE DRIVE HELPERS
// =========================================
async function getAuth() {
    // Priority 1: ANN specific credentials
    let raw = process.env.ANN_GOOGLE_APPLICATION_CREDENTIALS;

    // Priority 2: MUNCHOFM credentials (fallback if user is reusing the same service account)
    // This is a guess to be helpful since user didn't specify new creds but provided the folder ID 
    // which implies they have a working setup.
    if (!raw) {
        console.log("ANN_GOOGLE_APPLICATION_CREDENTIALS not found, trying fallback to MUNCHOFM...");
        raw = process.env.MUNCHOFM_GOOGLE_APPLICATION_CREDENTIALS;
    }

    if (!raw) {
        throw new Error("Missing Google Credentials (ANN_GOOGLE_APPLICATION_CREDENTIALS)");
    }

    try {
        const credentials = JSON.parse(raw);
        return new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
    } catch (e) {
        // Assume file path
        return new google.auth.GoogleAuth({
            keyFilename: raw,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
    }
}

async function createFolder(drive, name, parentId) {
    const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };
    const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
    });
    return res.data;
}

// =========================================
// APPSHEET HELPERS
// =========================================
async function addToAppSheet(projectName, link) {
    if (!APP_ID || !ACCESS_KEY) {
        console.error("Missing AppSheet Credentials");
        return { error: "Missing AppSheet Credentials" };
    }
    
    const url = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APP_ID)}/tables/${encodeURIComponent(TABLE_NAME)}/Action`;
    
    // Assuming we are Adding a new row. 
    // If 'projectName' is the Key, this will work. 
    // If there is another Key column required, this might fail unless it has an Initial Value.
    const body = {
        Action: "Add", 
        Properties: {
            Locale: "en-US",
            Timezone: "UTC"
        },
        Rows: [
            {
                "projectName": projectName, // Mapping payload 'projectName' to column 'projectName'
                "projectFolderLink": link   // Mapping link to 'projectFolderLink'
            }
        ]
    };
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'ApplicationAccessKey': ACCESS_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            return { raw: text, status: res.status };
        }
    } catch (err) {
        return { error: err.message };
    }
}
