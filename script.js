const API_BASE = "http://127.0.0.1:5000";
let token = localStorage.getItem("token");

window.onload = function () {
    if (token) {
        showStorage();
        listFiles();
    }
};

function showStorage() {
    document.getElementById("auth").style.display = "none";
    document.getElementById("storage").style.display = "block";
}

function showAuth() {
    document.getElementById("auth").style.display = "block";
    document.getElementById("storage").style.display = "none";
}

function toggleAuth() {
    let isSignup = document.getElementById("signupBtn").style.display !== "none";
    
    if (isSignup) {
        document.getElementById("signupBtn").style.display = "none";
        document.getElementById("loginBtn").style.display = "inline";
        document.getElementById("confirmPassword").style.display = "none";
        document.getElementById("toggleAuth").innerText = "Don't have an account? Sign up";
    } else {
        document.getElementById("signupBtn").style.display = "inline";
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("confirmPassword").style.display = "inline";
        document.getElementById("toggleAuth").innerText = "Already have an account? Login";
    }
}

// **SIGNUP** functionality
function signup() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!username || !password || !confirmPassword) {
        return showError("All fields are required!");
    }

    if (password !== confirmPassword) {
        return showError("Passwords do not match!");
    }

    fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else {
                showSuccess(data.message);
                toggleAuth(); // Show login form after successful signup
            }
        })
        .catch(err => {
            showError("Signup Error: " + err);
        });
}

// **LOGIN** functionality
function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
        return showError("All fields are required!");
    }

    fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
        } else {
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("username", username);  // ✅ Store username

            token = data.access_token;
            showStorage();
            listFiles();
        }
    })
    .catch(err => {
        showError("Login Error: " + err);
    });
}


function showError(message) {
    const errorElement = document.getElementById("authError");
    errorElement.innerText = message;
    errorElement.style.display = "block";
}

function showSuccess(message) {
    const successElement = document.getElementById("authError");
    successElement.innerText = message;
    successElement.style.color = "green";
    successElement.style.display = "block";
    setTimeout(() => {
        successElement.style.display = "none";
    }, 3000);
}

function logout() {
    // Clear token and reset variables
    localStorage.removeItem("token");
    token = null;

    // Reset input fields
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("confirmPassword").value = "";

    // Reset auth visibility
    const auth = document.getElementById("auth");
    const storage = document.getElementById("storage");

    auth.style.display = "flex"; // 👈 This is key
    auth.style.flexDirection = "column"; // Optional: keeps layout nice

    storage.style.display = "none";

    // Reset error message if shown
    const errorElement = document.getElementById("authError");
    errorElement.style.display = "none";
    errorElement.style.color = "red";
    errorElement.innerText = "";

    // Reset to login mode
    document.getElementById("signupBtn").style.display = "none";
    document.getElementById("loginBtn").style.display = "inline";
    document.getElementById("confirmPassword").style.display = "none";
    document.getElementById("toggleAuth").innerText = "Don't have an account? Sign up";
}


// **UPLOAD FILE** functionality
// function uploadFile() {
//     const fileInput = document.getElementById("fileInput");
//     const file = fileInput.files[0];

//     if (!file) {
//         return alert("No file selected.");
//     }

//     const formData = new FormData();
//     formData.append("file", file);

//     fetch(`${API_BASE}/upload`, {
//         method: "POST",
//         headers: {
//             Authorization: `Bearer ${token}`,
//         },
//         body: formData,
//     })
//         .then(res => res.json())
//         .then(data => {
//             if (data.error) {
//                 alert(data.error);
//             } else {
//                 alert(data.message);
//                 listFiles();
//             }
//         })
//         .catch(err => {
//             alert("Error uploading file: " + err);
//         });
// }

function uploadFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        return alert("No file selected.");
    }

    // STEP 1: Get latest file list from server before uploading
    fetch(`${API_BASE}/list`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    .then(res => res.json())
    .then(data => {
        const files = data.files || []; // Assumes the response is { files: [...] }

        const existingFilenames = files.map(f => f.name);

        if (existingFilenames.includes(file.name)) {
            alert("❗ A file with this name already exists.");
            return; // ⛔ Stop here — do NOT proceed to upload
        }

        // ✅ STEP 2: Proceed with upload only if name is unique
        const formData = new FormData();
        formData.append("file", file);

        fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert(data.message);
                listFiles();
            }
        })
        .catch(err => {
            alert("Error uploading file: " + err);
        });
    })
    .catch(err => {
        alert("Error checking for duplicates: " + err);
    });
}







// **LIST FILES** functionality
function listFiles() {
    fetch(`${API_BASE}/list`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    })
    .then(res => res.json())
    .then(data => {
        console.log("File List Response:", data);  // Debugging

        if (data.files) {
            const fileList = document.getElementById("fileList");
            fileList.innerHTML = ""; // Clear previous list
            data.files.forEach(file => {
                const listItem = document.createElement("li");
            
                // File name
                const fileNameSpan = document.createElement("span");
                fileNameSpan.className = "filename";
                fileNameSpan.textContent = file;
            
                // Actions (Download + Delete)
                const actionsDiv = document.createElement("div");
                actionsDiv.className = "file-actions";
            
                const downloadBtn = document.createElement("button");
                downloadBtn.textContent = "Download";
                downloadBtn.onclick = () => downloadFile(file);
            
                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Delete";
                deleteBtn.onclick = () => deleteFile(file);
            
                actionsDiv.appendChild(downloadBtn);
                actionsDiv.appendChild(deleteBtn);
            
                // Add name and actions to list item
                listItem.appendChild(fileNameSpan);
                listItem.appendChild(actionsDiv);
            
                // Append list item to the file list
                document.getElementById("fileList").appendChild(listItem);
            });
            
            
        } else {
            alert("Error fetching files: " + (data.error || "Unknown error"));
        }
    })
    .catch(err => console.error("Error fetching files:", err));
}


function downloadFile(fileName) {
    const token = localStorage.getItem("token"); // Ensure token exists
    if (!token) {
        alert("Error: Authentication required.");
        return;
    }

    fetch(`${API_BASE}/download?file_name=${encodeURIComponent(fileName)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || "Download failed"); });
        }
        return response.blob(); // Convert response to blob
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName; // Set the downloaded file name
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url); // Free memory
    })
    .catch(err => {
        console.error("Error downloading file:", err);
        alert("Download failed: " + err.message);
    });
}


// **DELETE FILE** functionality
function deleteFile(fileName) {
    if (!confirm("Are you sure you want to delete this file?")) return;

    const token = localStorage.getItem("token");
    if (!token) {
        alert("You are not authenticated.");
        return;
    }

    // Construct the DELETE URL with the file_name as a query parameter
    const deleteUrl = `${API_BASE}/delete?file_name=${encodeURIComponent(fileName)}`;

    fetch(deleteUrl, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("❌ Error deleting file: " + data.error);
        } else {
            alert("✅ File deleted successfully!");
            listFiles(); // Refresh the file list
        }
    })
    .catch(err => {
        console.error("❌ Error deleting file:", err);
        alert("Error deleting file. Check the console for details.");
    });
}

