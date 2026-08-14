const express = require("express");
const cors = require("cors");
require("dotenv").config();
const crypto = require("crypto");
const session = require("express-session");

const app = express();


app.set("trust proxy", 1);

app.use(
    session({
        secret: process.env.SESSION_SECRET || "cloudvandana-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: "none",
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);


app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://cloudvandana-salesforce-frontend.onrender.com"
    ],
    credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "CloudVandana Salesforce CRUD Backend is running"
    });
});

app.get("/auth/login", (req, res) => {
    const codeVerifier = crypto.randomBytes(32).toString("hex");

    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

    req.session = req.session || {};
    req.session.codeVerifier = codeVerifier;

    const loginUrl =
        `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/authorize` +
        `?response_type=code` +
        `&client_id=${encodeURIComponent(process.env.SALESFORCE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(process.env.SALESFORCE_CALLBACK_URL)}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256`;

    res.redirect(loginUrl);
});

app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("Authorization code is missing");
    }

    try {
        const response = await fetch(
            `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code,
                    client_id: process.env.SALESFORCE_CLIENT_ID,
                    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
                    redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
                    code_verifier: req.session.codeVerifier
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Salesforce token error:", data);
            return res.status(400).json(data);
        }

        req.session.accessToken = data.access_token;
req.session.instanceUrl = data.instance_url;

req.session.save((err) => {
    if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({
            error: "Failed to save login session"
        });
    }

    res.redirect("https://cloudvandana-salesforce-frontend.onrender.com");
});

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Salesforce authentication failed"
        });
    }
});




app.get("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({
        error: "Failed to logout"
      });
    }

    res.clearCookie("connect.sid");

    res.redirect("https://cloudvandana-salesforce-frontend.onrender.com");
  });
});



// Get records for selected Salesforce object
app.get("/api/salesforce/:objectName", async (req, res) => {
    try {
        const accessToken = req.session.accessToken;
        const instanceUrl = req.session.instanceUrl;
        const { objectName } = req.params;

        if (!accessToken || !instanceUrl) {
            return res.status(401).json({
                error: "Please login with Salesforce first"
            });
        }

        const allowedObjects = {
    Account:
        "SELECT Id, Name, Phone, Website, Industry, Type FROM Account ORDER BY Id",

    Contact:
        "SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact ORDER BY Id",

    Lead:
        "SELECT Id, FirstName, LastName, Company, Email, Phone FROM Lead ORDER BY Id",

    Opportunity:
        "SELECT Id, Name, StageName, Amount, CloseDate, Probability FROM Opportunity ORDER BY Id",

    Case:
        "SELECT Id, CaseNumber, Subject, Status, Priority, Origin FROM Case ORDER BY Id"
};

        if (!allowedObjects[objectName]) {
            return res.status(400).json({
                error: "Invalid Salesforce object"
            });
        }

       const query = allowedObjects[objectName];

const offset = parseInt(req.query.offset) || 0;

const paginatedQuery = `${query} LIMIT 20 OFFSET ${offset}`;
console.log("SOQL:", paginatedQuery);

const response = await fetch(
    `${instanceUrl}/services/data/v64.0/query/?q=${encodeURIComponent(paginatedQuery)}`,
    {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    }
);

const data = await response.json();

console.log("OFFSET:", offset);
console.log("Salesforce totalSize:", data.totalSize);
console.log("Salesforce records:", data.records?.length);

if (!response.ok) {
    return res.status(response.status).json(data);
}

res.json({
    records: data.records,
    totalSize: data.totalSize,
    hasMore: offset + data.records.length < data.totalSize,
    nextOffset: offset + data.records.length
});

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch Salesforce records"
        });
    }
});

// Create record for selected Salesforce object
app.post("/api/salesforce/:objectName", async (req, res) => {
    try {
        const accessToken = req.session.accessToken;
        const instanceUrl = req.session.instanceUrl;
        const { objectName } = req.params;

        if (!accessToken || !instanceUrl) {
            return res.status(401).json({
                error: "Please login with Salesforce first"
            });
        }

        const allowedObjects = [
            "Account",
            "Opportunity",
            "Lead",
            "Contact",
            "Case"
        ];

        if (!allowedObjects.includes(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object"
            });
        }

        const response = await fetch(
            `${instanceUrl}/services/data/v64.0/sobjects/${objectName}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(req.body)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(201).json({
            message: `${objectName} created successfully`,
            record: data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: `Failed to create ${req.params.objectName}`
        });
    }
});







// Update record for selected Salesforce object
app.put("/api/salesforce/:objectName/:id", async (req, res) => {
    try {
        const accessToken = req.session.accessToken;
        const instanceUrl = req.session.instanceUrl;
        const { objectName, id } = req.params;

        if (!accessToken || !instanceUrl) {
            return res.status(401).json({
                error: "Please login with Salesforce first"
            });
        }

        const allowedObjects = [
            "Account",
            "Opportunity",
            "Lead",
            "Contact",
            "Case"
        ];

        if (!allowedObjects.includes(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object"
            });
        }

        const response = await fetch(
            `${instanceUrl}/services/data/v64.0/sobjects/${objectName}/${id}`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(req.body)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            let errorData;

            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = {
                    error: errorText
                };
            }

            return res.status(response.status).json(errorData);
        }

        res.json({
            message: `${objectName} updated successfully`,
            id: id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: `Failed to update ${req.params.objectName}`
        });
    }
});


// Delete record for selected Salesforce object
app.delete("/api/salesforce/:objectName/:id", async (req, res) => {
    try {
        const accessToken = req.session.accessToken;
        const instanceUrl = req.session.instanceUrl;
        const { objectName, id } = req.params;

        if (!accessToken || !instanceUrl) {
            return res.status(401).json({
                error: "Please login with Salesforce first"
            });
        }

        const allowedObjects = [
            "Account",
            "Opportunity",
            "Lead",
            "Contact",
            "Case"
        ];

        if (!allowedObjects.includes(objectName)) {
            return res.status(400).json({
                error: "Invalid Salesforce object"
            });
        }

        const response = await fetch(
            `${instanceUrl}/services/data/v64.0/sobjects/${objectName}/${id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            let errorData;

            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = {
                    error: errorText
                };
            }

            return res.status(response.status).json(errorData);
        }

        res.json({
            message: `${objectName} deleted successfully`,
            id: id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: `Failed to delete ${req.params.objectName}`
        });
    }
});



const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});