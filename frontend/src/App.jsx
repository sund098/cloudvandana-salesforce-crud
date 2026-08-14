import { useEffect, useState } from "react";
import "./App.css";

function App() {
  
  const [records, setRecords] = useState([]);
const [selectedObject, setSelectedObject] = useState("Contact");

const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [loading, setLoading] = useState(false);
const limit = 20;


  const [form, setForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    Phone: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(""); 

  const [viewingRecord, setViewingRecord] = useState(null);

  
const loadRecords = async (newOffset = 0) => {
    if (loading) return;

    setLoading(true);

    try {
        const response = await fetch(
            `http://localhost:5000/api/salesforce/${selectedObject}?offset=${newOffset}`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Failed to load records");
            return;
        }

        console.log("Loading offset:", newOffset);
        console.log("Records received:", data.records.length);
        console.log("Has more:", data.hasMore);
        console.log("Next offset:", data.nextOffset);

        setRecords(prevRecords =>
            newOffset === 0
                ? data.records
                : [...prevRecords, ...data.records]
        );

        setOffset(newOffset);

        setHasMore(
            newOffset + data.records.length < data.totalSize
        );

    } catch (error) {
        console.error(error);
        setMessage("Failed to connect to backend");
    } finally {
        setLoading(false);
    }
};


const handleScroll = () => {
  if (
    window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 100 &&
    hasMore &&
    !loading
  ) {
    loadRecords(offset + limit);
  }
};

 
useEffect(() => {
  setOffset(0);
  
  loadRecords(0);
}, [selectedObject]);




useEffect(() => {
  window.addEventListener("scroll", handleScroll);

  return () => {
    window.removeEventListener("scroll", handleScroll);
  };
}, [offset, hasMore, loading]);





  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingId
  ? `http://localhost:5000/api/salesforce/${selectedObject}/${editingId}`
  : `http://localhost:5000/api/salesforce/${selectedObject}`;


  let payload = {};

if (selectedObject === "Account") {
    payload = {
        Name: form.Name,
        Phone: form.Phone
    };
} else if (selectedObject === "Contact") {
    payload = {
        FirstName: form.FirstName,
        LastName: form.LastName,
        Email: form.Email,
        Phone: form.Phone
    };
} else if (selectedObject === "Lead") {
    payload = {
        FirstName: form.FirstName,
        LastName: form.LastName,
        Company: form.Company,
        Email: form.Email,
        Phone: form.Phone
    };
} else if (selectedObject === "Opportunity") {
    payload = {
        Name: form.Name,
        StageName: form.StageName,
        Amount: form.Amount ? Number(form.Amount) : null,
        CloseDate: form.CloseDate
    };
} else if (selectedObject === "Case") {
    payload = {
        Subject: form.Subject,
        Status: form.Status,
        Priority: form.Priority
    };
}



      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Operation failed");
        return;
      }

     setMessage(
  editingId
    ? `${selectedObject} updated successfully`
    : `${selectedObject} created successfully`
);

      setForm({
        FirstName: "",
        LastName: "",
        Email: "",
        Phone: "",
      });

      setEditingId(null);
      loadRecords();
    } catch (error) {
      console.error(error);
      setMessage("Failed to connect to backend");
    }
  };

 
  const handleEdit = (record) => {
    setEditingId(record.Id);

    setForm({
        FirstName: record.FirstName || "",
        LastName: record.LastName || "",
        Email: record.Email || "",
        Phone: record.Phone || "",

        Name: record.Name || "",
        Company: record.Company || "",

        StageName: record.StageName || "",
        Amount: record.Amount || "",
        CloseDate: record.CloseDate || "",

        Subject: record.Subject || "",
        Status: record.Status || "",
        Priority: record.Priority || "",
    });
};



const handleView = (record) => {
    setViewingRecord(record);
};

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/salesforce/${selectedObject}/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to delete contact");
        return;
      }

      setMessage(`${selectedObject} deleted successfully`);
      loadRecords();
    } catch (error) {
      console.error(error);
      setMessage("Failed to connect to backend");
    }
  };

  const handleLogin = () => {
    window.location.href = "http://localhost:5000/auth/login";
  };

  return (
    <div className="app">
      <header>
        <h1>Salesforce CRUD Manager</h1>

        <button onClick={handleLogin}>
          Login with Salesforce
        </button>

      <button onClick={() => {
  window.location.href = "http://localhost:5000/auth/logout";
}}>
  Logout
</button>

      </header>

    <section className="object-selector">
  <label htmlFor="objectSelect">
    Select Salesforce Object:
  </label>

  <select
    id="objectSelect"
    value={selectedObject}
    
    onChange={(e) => {
  setSelectedObject(e.target.value);
  setEditingId(null);

  setForm({
    FirstName: "",
    LastName: "",
    Email: "",
    Phone: "",
    Name: "",
    Company: "",
    StageName: "",
    Amount: "",
    CloseDate: "",
    Subject: "",
    Status: "",
    Priority: "",
  });
}}
  >
    <option value="Account">Account</option>
    <option value="Opportunity">Opportunity</option>
    <option value="Lead">Lead</option>
    <option value="Contact">Contact</option>
    <option value="Case">Case</option>
  </select>
</section>



      {message && <div className="message">{message}</div>}


     {viewingRecord && (
    <section className="view-section">
        <h2>View {selectedObject}</h2>

        {Object.entries(viewingRecord)
            .filter(([key]) => key !== "attributes")
            .map(([key, value]) => (
                <p key={key}>
                    <strong>{key}:</strong>{" "}
                    {value === null || value === undefined
                        ? ""
                        : String(value)}
                </p>
            ))}

        <button
            type="button"
            onClick={() => setViewingRecord(null)}
        >
            Close
        </button>
    </section>
)}


      <section className="form-section">
       <h2>
  {editingId ? `Edit ${selectedObject}` : `Add ${selectedObject}`}
</h2>

        <form onSubmit={handleSubmit}>
         {selectedObject === "Account" && (
  <>
    <input
      type="text"
      name="Name"
      placeholder="Account Name"
      value={form.Name || ""}
      onChange={handleChange}
      required
    />

    <input
      type="text"
      name="Phone"
      placeholder="Phone"
      value={form.Phone || ""}
      onChange={handleChange}
    />
  </>
)}

{selectedObject === "Contact" && (
  <>
    <input
      type="text"
      name="FirstName"
      placeholder="First Name"
      value={form.FirstName || ""}
      onChange={handleChange}
      required
    />

    <input
      type="text"
      name="LastName"
      placeholder="Last Name"
      value={form.LastName || ""}
      onChange={handleChange}
      required
    />

    <input
      type="email"
      name="Email"
      placeholder="Email"
      value={form.Email || ""}
      onChange={handleChange}
    />

    <input
      type="text"
      name="Phone"
      placeholder="Phone"
      value={form.Phone || ""}
      onChange={handleChange}
    />
  </>
)}

{selectedObject === "Lead" && (
  <>
    <input
      type="text"
      name="FirstName"
      placeholder="First Name"
      value={form.FirstName || ""}
      onChange={handleChange}
    />

    <input
      type="text"
      name="LastName"
      placeholder="Last Name"
      value={form.LastName || ""}
      onChange={handleChange}
      required
    />

    <input
      type="text"
      name="Company"
      placeholder="Company"
      value={form.Company || ""}
      onChange={handleChange}
      required
    />

    <input
      type="email"
      name="Email"
      placeholder="Email"
      value={form.Email || ""}
      onChange={handleChange}
    />

    <input
      type="text"
      name="Phone"
      placeholder="Phone"
      value={form.Phone || ""}
      onChange={handleChange}
    />
  </>
)}

{selectedObject === "Opportunity" && (
  <>
    <input
      type="text"
      name="Name"
      placeholder="Opportunity Name"
      value={form.Name || ""}
      onChange={handleChange}
      required
    />

    <input
      type="text"
      name="StageName"
      placeholder="Stage"
      value={form.StageName || ""}
      onChange={handleChange}
      required
    />

    <input
      type="number"
      name="Amount"
      placeholder="Amount"
      value={form.Amount || ""}
      onChange={handleChange}
    />

    <input
      type="date"
      name="CloseDate"
      value={form.CloseDate || ""}
      onChange={handleChange}
      required
    />
  </>
)}

{selectedObject === "Case" && (
  <>
    <input
      type="text"
      name="Subject"
      placeholder="Subject"
      value={form.Subject || ""}
      onChange={handleChange}
    />

    <input
      type="text"
      name="Status"
      placeholder="Status"
      value={form.Status || ""}
      onChange={handleChange}
    />

    <input
      type="text"
      name="Priority"
      placeholder="Priority"
      value={form.Priority || ""}
      onChange={handleChange}
    />
  </>
)}

         

          <button type="submit">
  {editingId ? `Update ${selectedObject}` : `Add ${selectedObject}`}
</button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  FirstName: "",
                  LastName: "",
                  Email: "",
                  Phone: "",
                });
              }}
            >
              Cancel
            </button>
          )}
        </form>
      </section>

      <section className="contacts-section">
        <div className="contacts-header">
          <h2>{selectedObject}s</h2>

          <button onClick={() => loadRecords(0, false)}>
            Refresh
          </button>
        </div>

        {records.length === 0 ? (
          <p>No contacts found.</p>
        ) : (

          <> 
         <table>
   <thead>
    <tr>

        {selectedObject === "Contact" && (
            <>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Title</th>
            </>
        )}

        {selectedObject === "Account" && (
            <>
                <th>Account Name</th>
                <th>Phone</th>
                <th>Website</th>
                <th>Industry</th>
                <th>Type</th>
            </>
        )}

        {selectedObject === "Lead" && (
            <>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
            </>
        )}

        {selectedObject === "Opportunity" && (
            <>
                <th>Opportunity Name</th>
                <th>Stage</th>
                <th>Amount</th>
                <th>Close Date</th>
                <th>Probability</th>
            </>
        )}

        {selectedObject === "Case" && (
            <>
                <th>Case Number</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Origin</th>
            </>
        )}

        <th>Actions</th>

    </tr>
</thead>

    <tbody>
    {records.map((record) => (
        <tr key={record.Id}>

            {selectedObject === "Contact" && (
                <>
                    <td>{record.FirstName}</td>
                    <td>{record.LastName}</td>
                    <td>{record.Email}</td>
                    <td>{record.Phone}</td>
                    <td>{record.Title}</td>
                </>
            )}

            {selectedObject === "Account" && (
                <>
                    <td>{record.Name}</td>
                    <td>{record.Phone}</td>
                    <td>{record.Website}</td>
                    <td>{record.Industry}</td>
                    <td>{record.Type}</td>
                </>
            )}

            {selectedObject === "Lead" && (
                <>
                    <td>{record.FirstName}</td>
                    <td>{record.LastName}</td>
                    <td>{record.Company}</td>
                    <td>{record.Email}</td>
                    <td>{record.Phone}</td>
                </>
            )}

            {selectedObject === "Opportunity" && (
                <>
                    <td>{record.Name}</td>
                    <td>{record.StageName}</td>
                    <td>{record.Amount}</td>
                    <td>{record.CloseDate}</td>
                    <td>{record.Probability}</td>
                </>
            )}

            {selectedObject === "Case" && (
                <>
                    <td>{record.CaseNumber}</td>
                    <td>{record.Subject}</td>
                    <td>{record.Status}</td>
                    <td>{record.Priority}</td>
                    <td>{record.Origin}</td>
                </>
            )}

           <td>
    <button onClick={() => handleView(record)}>
        View
    </button>

    <button onClick={() => handleEdit(record)}>
        Edit
    </button>

    <button onClick={() => handleDelete(record.Id)}>
        Delete
    </button>
</td>

        </tr>
    ))}
</tbody>
</table>


</>

)}

</section>
    </div>

  
  );
}

export default App;