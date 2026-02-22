import os
from flask import Flask, request, jsonify, send_file
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from dotenv import load_dotenv
import b2sdk.v2 as b2
import hashlib
import requests
from io import BytesIO

# Load environment variables
load_dotenv()

B2_APPLICATION_KEY_ID = os.getenv("B2_APPLICATION_KEY_ID")
B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY")
B2_BUCKET_NAME = os.getenv("B2_BUCKET_NAME")
B2_BUCKET_ID = os.getenv("B2_BUCKET_ID")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

# Flask setup
app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = JWT_SECRET_KEY
CORS(app)
jwt = JWTManager(app)

# Initialize B2
info = b2.InMemoryAccountInfo()
b2_api = b2.B2Api(info)
b2_api.authorize_account("production", B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY)




# Get bucket
bucket = b2_api.get_bucket_by_name(B2_BUCKET_NAME)

# Simulated user database
users = {}

# 🟢 USER AUTHENTICATION ROUTES
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if username in users:
        return jsonify({"error": "User already exists"}), 400

    users[username] = hashlib.sha256(password.encode()).hexdigest()
    return jsonify({"message": "User registered successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if username not in users or users[username] != hashlib.sha256(password.encode()).hexdigest():
        return jsonify({"error": "Username or password incorrect"}), 401

    access_token = create_access_token(identity=username)
    return jsonify({"access_token": access_token}), 200

# 🟢 FILE MANAGEMENT ROUTES (UPLOAD, LIST, DOWNLOAD, DELETE)
@app.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    user = get_jwt_identity()
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded!"}), 400

    file = request.files['file']
    file_name = f"{user}/{file.filename}"  # Store files in user-specific folders

    try:
        bucket.upload_bytes(file.read(), file_name)
        return jsonify({"message": f"File '{file.filename}' uploaded successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/list", methods=["GET"])
@jwt_required()
def list_files():
    """Lists all files uploaded by the user."""
    user = get_jwt_identity()
    try:
        print(f"📂 Checking files for user: {user}")
        file_list = []
        
        # List user-specific files
        for file_version, _ in bucket.ls(folder_to_list=user):
            file_list.append(file_version.file_name)
            print(f"✅ Found file: {file_version.file_name}")

        # Debug: Print response before sending
        print("📤 Sending response:", jsonify({"files": file_list}).get_json())

        return jsonify({"files": file_list}), 200

    except Exception as e:
        print(f"❌ Error listing files: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/download", methods=["GET"])
@jwt_required()
def download_file():
    """Downloads a file from Backblaze B2 and sends it to the user."""
    user = get_jwt_identity()
    file_name = request.args.get("file_name")

    if not file_name:
        return jsonify({"error": "Missing file_name parameter"}), 400

    try:
        print(f"🔍 Fetching file: {file_name}")

        # Step 1: Get Authorization Token
        auth_response = requests.get(
            "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
            auth=(B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY)
        )
        auth_data = auth_response.json()
        auth_token = auth_data.get("authorizationToken")

        if not auth_token:
            return jsonify({"error": "Failed to get authorization token"}), 500

        # Step 2: Generate the download URL
        download_url = f"https://f005.backblazeb2.com/file/secure-storage-2025/{file_name}"
        headers = {"Authorization": auth_token}

        # Step 3: Fetch the file from Backblaze
        response = requests.get(download_url, headers=headers, stream=True)

        if response.status_code != 200:
            return jsonify({"error": "Failed to fetch file"}), response.status_code

        # Step 4: Save the file temporarily
        temp_path = f"/tmp/{file_name}"
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)  # Ensure directory exists

        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)

        # Step 5: Send the file to the user for download
        return send_file(temp_path, as_attachment=True)

    except Exception as e:
        print(f"❌ Error downloading file: {e}")
        return jsonify({"error": str(e)}), 500



@app.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_file():
    """Deletes a file from Backblaze B2."""
    user = get_jwt_identity()
    file_name = request.args.get("file_name")

    if not file_name:
        return jsonify({"error": "Missing file_name parameter"}), 400

    try:
        print(f"🗑️ Deleting file: {file_name}")

        # Step 1: Authorize
        auth_response = requests.get(
            "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
            auth=(B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY)
        )
        auth_data = auth_response.json()

        api_url = auth_data["apiUrl"]
        auth_token = auth_data["authorizationToken"]
        account_id = auth_data["accountId"]

        # Step 2: Get Upload URL (needed to get file ID)
        headers = {"Authorization": auth_token}

        # Get list of file versions to find fileId
        list_files_url = f"{api_url}/b2api/v2/b2_list_file_versions"
        payload = {
            "bucketId": B2_BUCKET_ID,
            "prefix": file_name,
            "maxFileCount": 1
        }

        list_response = requests.post(list_files_url, json=payload, headers=headers)
        list_data = list_response.json()

        if "files" not in list_data or len(list_data["files"]) == 0:
            return jsonify({"error": f"File '{file_name}' not found"}), 404

        file_id = list_data["files"][0]["fileId"]

        # Step 3: Delete file version
        delete_url = f"{api_url}/b2api/v2/b2_delete_file_version"
        delete_payload = {
            "fileName": file_name,
            "fileId": file_id
        }

        delete_response = requests.post(delete_url, json=delete_payload, headers=headers)

        if delete_response.status_code == 200:
            return jsonify({"message": f"File '{file_name}' deleted successfully"}), 200
        else:
            return jsonify({"error": delete_response.json()}), delete_response.status_code

    except Exception as e:
        print(f"❌ Error deleting file: {e}")
        return jsonify({"error": str(e)}), 500

# Run the Flask app
if __name__ == "__main__":
    app.run(debug=True)
