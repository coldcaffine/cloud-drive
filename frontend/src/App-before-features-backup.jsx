import { useEffect, useState } from "react";
import {
  Cloud,
  Search,
  Plus,
  Folder,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Share2,
  Star,
  HardDrive,
  Upload,
  MoreVertical,
  Grid2X2,
  List,
} from "lucide-react";
import api from "./api";

function App() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(function () {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const filesResponse = await api.get("/files");
      const foldersResponse = await api.get("/folders");

      setFiles(filesResponse.data || []);
      setFolders(foldersResponse.data || []);
    } catch (err) {
      console.error(err);

      if (err.response && err.response.data) {
        setError(
          err.response.data.detail ||
            "Could not load your CloudDrive data."
        );
      } else {
        setError("Could not connect to the backend.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event) {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post("/files/upload", formData);

      await loadData();
    } catch (err) {
      console.error(err);

      if (err.response && err.response.data) {
        setError(
          err.response.data.detail ||
            "Upload failed."
        );
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleCreateFolder() {
    const folderName = window.prompt("Enter folder name:");

    if (!folderName) {
      return;
    }

    const name = folderName.trim();

    if (!name) {
      return;
    }

    try {
      setCreatingFolder(true);
      setError("");

      await api.post("/folders", {
        name: name,
        parent_id: null,
      });

      await loadData();
    } catch (err) {
      console.error(err);

      if (err.response && err.response.data) {
        setError(
          err.response.data.detail ||
            "Could not create folder."
        );
      } else {
        setError("Could not create folder.");
      }
    } finally {
      setCreatingFolder(false);
    }
  }

  function getFileIcon(filename) {
    if (!filename) {
      return <File size={22} />;
    }

    const parts = filename.split(".");
    const extension = parts[parts.length - 1].toLowerCase();

    if (
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "png" ||
      extension === "gif" ||
      extension === "webp" ||
      extension === "svg"
    ) {
      return <ImageIcon size={22} />;
    }

    if (
      extension === "pdf" ||
      extension === "doc" ||
      extension === "docx" ||
      extension === "txt"
    ) {
      return <FileText size={22} />;
    }

    return <File size={22} />;
  }

  function formatSize(bytes) {
    if (!bytes) {
      return "0 B";
    }

    if (bytes < 1024) {
      return String(bytes) + " B";
    }

    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }

    if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const searchText = search.toLowerCase();

  const filteredFiles = files.filter(function (file) {
    return (
      file.name &&
      file.name.toLowerCase().includes(searchText)
    );
  });

  const filteredFolders = folders.filter(function (folder) {
    return (
      folder.name &&
      folder.name.toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-[#202024]">

      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-black/5 bg-white px-5 py-6">

        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6d5dfc] text-white shadow-lg">
            <Cloud size={22} />
          </div>

          <div>
            <h1 className="text-lg font-bold">
              CloudDrive
            </h1>

            <p className="text-xs text-gray-400">
              Your space, everywhere.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateFolder}
          disabled={creatingFolder}
          className="mb-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6d5dfc] px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-[#5e4ee8]"
        >
          <Plus size={19} />
          {creatingFolder ? "Creating..." : "New folder"}
        </button>

        <nav className="space-y-2">

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl bg-[#f0edff] px-4 py-3 text-sm font-semibold text-[#6253e8]"
          >
            <HardDrive size={18} />
            My Drive
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50"
          >
            <Share2 size={18} />
            Shared with me
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50"
          >
            <Star size={18} />
            Starred
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50"
          >
            <Trash2 size={18} />
            Trash
          </button>

        </nav>

        <div className="mt-auto rounded-2xl bg-[#faf9ff] p-4">

          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">
              Storage
            </span>

            <span className="text-xs text-gray-400">
              0 GB used
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-[8%] rounded-full bg-[#6d5dfc]" />
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Your files are safely stored in the cloud.
          </p>

        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-4 px-2 text-left text-sm text-gray-400 hover:text-red-500"
        >
          Log out
        </button>

      </aside>

      <main className="ml-64 min-h-screen px-10 py-8">

        <header className="mb-10 flex items-center justify-between">

          <div>
            <p className="mb-1 text-sm font-medium text-[#6d5dfc]">
              Welcome back 👋
            </p>

            <h2 className="text-3xl font-bold">
              My Drive
            </h2>
          </div>

          <div className="flex w-80 items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-sm">

            <Search
              size={19}
              className="text-gray-400"
            />

            <input
              type="text"
              placeholder="Search your files..."
              value={search}
              onChange={function (event) {
                setSearch(event.target.value);
              }}
              className="w-full bg-transparent text-sm outline-none"
            />

          </div>

        </header>

        <section className="mb-10 grid grid-cols-3 gap-5">

          <label className="cursor-pointer rounded-3xl border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />

            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
              <Upload size={22} />
            </div>

            <h3 className="font-semibold">
              {uploading ? "Uploading..." : "Upload files"}
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Add files to your drive
            </p>

          </label>

          <button
            type="button"
            onClick={handleCreateFolder}
            className="rounded-3xl border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >

            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
              <Folder size={22} />
            </div>

            <h3 className="font-semibold">
              New folder
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Organize your files
            </p>

          </button>

          <button
            type="button"
            className="rounded-3xl border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >

            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f8f0] text-[#38a169]">
              <Share2 size={22} />
            </div>

            <h3 className="font-semibold">
              Share something
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Collaborate with others
            </p>

          </button>

        </section>

        <section>

          <div className="mb-5 flex items-center justify-between">

            <div>
              <h3 className="text-lg font-bold">
                Your files
              </h3>

              <p className="text-sm text-gray-400">
                {files.length} files · {folders.length} folders
              </p>
            </div>

            <div className="flex rounded-xl border border-black/5 bg-white p-1 shadow-sm">

              <button
                type="button"
                onClick={function () {
                  setView("grid");
                }}
                className="rounded-lg p-2"
              >
                <Grid2X2 size={17} />
              </button>

              <button
                type="button"
                onClick={function () {
                  setView("list");
                }}
                className="rounded-lg p-2"
              >
                <List size={17} />
              </button>

            </div>

          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (

            <div className="rounded-3xl bg-white p-16 text-center shadow-sm">

              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#6d5dfc]" />

              <p className="text-sm text-gray-400">
                Loading your files...
              </p>

            </div>

          ) : filteredFiles.length === 0 &&
            filteredFolders.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">

              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0edff] text-[#6d5dfc]">
                <Cloud size={30} />
              </div>

              <h3 className="mb-2 text-lg font-bold">
                Your drive is empty
              </h3>

              <p className="mx-auto max-w-md text-sm text-gray-400">
                Upload a file or create a folder to start
                building your CloudDrive.
              </p>

            </div>

          ) : view === "grid" ? (

            <div className="grid grid-cols-4 gap-5">

              {filteredFolders.map(function (folder) {
                return (
                  <div
                    key={"folder-" + folder.id}
                    className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                  >

                    <div className="mb-8 flex items-center justify-between">

                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
                        <Folder size={22} />
                      </div>

                      <button type="button">
                        <MoreVertical size={18} />
                      </button>

                    </div>

                    <h4 className="truncate text-sm font-semibold">
                      {folder.name}
                    </h4>

                    <p className="mt-1 text-xs text-gray-400">
                      Folder
                    </p>

                  </div>
                );
              })}

              {filteredFiles.map(function (file) {
                return (
                  <div
                    key={"file-" + file.id}
                    className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                  >

                    <div className="mb-8 flex items-center justify-between">

                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
                        {getFileIcon(file.name)}
                      </div>

                      <button type="button">
                        <MoreVertical size={18} />
                      </button>

                    </div>

                    <h4 className="truncate text-sm font-semibold">
                      {file.name}
                    </h4>

                    <p className="mt-1 text-xs text-gray-400">
                      {formatSize(file.size)}
                    </p>

                  </div>
                );
              })}

            </div>

          ) : (

            <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">

              <div className="grid grid-cols-[1fr_160px_80px] border-b border-gray-100 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <span>Name</span>
                <span>Size</span>
                <span></span>
              </div>

              {filteredFolders.map(function (folder) {
                return (
                  <div
                    key={"folder-list-" + folder.id}
                    className="grid grid-cols-[1fr_160px_80px] items-center border-b border-gray-50 px-6 py-4"
                  >

                    <div className="flex items-center gap-3">

                      <Folder
                        size={20}
                        className="text-[#e69b26]"
                      />

                      <span className="text-sm font-medium">
                        {folder.name}
                      </span>

                    </div>

                    <span className="text-sm text-gray-400">
                      Folder
                    </span>

                    <button type="button">
                      <MoreVertical size={18} />
                    </button>

                  </div>
                );
              })}

              {filteredFiles.map(function (file) {
                return (
                  <div
                    key={"file-list-" + file.id}
                    className="grid grid-cols-[1fr_160px_80px] items-center border-b border-gray-50 px-6 py-4"
                  >

                    <div className="flex items-center gap-3">

                      <span className="text-[#6d5dfc]">
                        {getFileIcon(file.name)}
                      </span>

                      <span className="text-sm font-medium">
                        {file.name}
                      </span>

                    </div>

                    <span className="text-sm text-gray-400">
                      {formatSize(file.size)}
                    </span>

                    <button type="button">
                      <MoreVertical size={18} />
                    </button>

                  </div>
                );
              })}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default App;
