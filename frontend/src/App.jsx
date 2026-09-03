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
  Download,
  HardDrive,
  Upload,
  Grid2X2,
  List,
  X,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";

import api from "./api";

function App() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);

  const [trashFiles, setTrashFiles] = useState([]);
  const [trashFolders, setTrashFolders] = useState([]);

  const [starredFiles, setStarredFiles] = useState([]);
  const [starredFolders, setStarredFolders] = useState([]);

  const [sharedItems, setSharedItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");

  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [currentPage, setCurrentPage] = useState("drive");

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  const [sharedFolderId, setSharedFolderId] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareItem, setShareItem] = useState(null);
  const [sharing, setSharing] = useState(false);

  const [publicLink, setPublicLink] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentFolderId, currentPage]);

  async function loadData() {
    try {
      if (sharedFolderId !== null) {
        return;
      }

      setLoading(true);
      setError("");

      const folderParams =
        currentFolderId === null
          ? {}
          : { parent_id: currentFolderId };

      const fileParams =
        currentFolderId === null
          ? {}
          : { folder_id: currentFolderId };

      const [
        filesResponse,
        foldersResponse,
        trashResponse,
        starredResponse,
        sharedResponse,
      ] = await Promise.all([
        api.get("/files", { params: fileParams }),
        api.get("/folders", { params: folderParams }),
        api.get("/trash"),
        api.get("/starred"),
        api.get("/shares/with-me"),
      ]);

      setFiles(
        Array.isArray(filesResponse.data)
          ? filesResponse.data
          : []
      );

      setFolders(
        Array.isArray(foldersResponse.data)
          ? foldersResponse.data
          : []
      );

      setTrashFiles(
        Array.isArray(trashResponse.data?.files)
          ? trashResponse.data.files
          : []
      );

      setTrashFolders(
        Array.isArray(trashResponse.data?.folders)
          ? trashResponse.data.folders
          : []
      );

      setStarredFiles(
        Array.isArray(starredResponse.data?.files)
          ? starredResponse.data.files
          : []
      );

      setStarredFolders(
        Array.isArray(starredResponse.data?.folders)
          ? starredResponse.data.folders
          : []
      );

      setSharedItems(
        Array.isArray(sharedResponse.data)
          ? sharedResponse.data
          : []
      );
    } catch (err) {
      console.error("Load data error:", err);

      setError(
        getErrorMessage(
          err,
          "Could not load your CloudDrive data."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function getErrorMessage(err, fallback) {
    const detail = err?.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item && typeof item === "object") {
            return item.msg || "Invalid request.";
          }

          return "Invalid request.";
        })
        .join(", ");
    }

    if (typeof detail === "string") {
      return detail;
    }

    if (detail && typeof detail === "object") {
      return detail.msg || fallback;
    }

    if (typeof err?.response?.data === "string") {
      return err.response.data;
    }

    if (err?.message) {
      return err.message;
    }

    return fallback;
  }

  async function openFolder(folder) {
    if (sharedFolderId !== null) {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/shared/folders/${folder.id}`
        );

        const data = response.data || {};

        setFiles(
          Array.isArray(data.files)
            ? data.files
            : []
        );

        setFolders(
          Array.isArray(data.folders)
            ? data.folders
            : []
        );

        setSharedFolderId(folder.id);
        setCurrentFolderId(folder.id);

        setFolderPath((prev) => [
          ...prev,
          {
            id: folder.id,
            name: data.folder?.name || folder.name,
          },
        ]);
      } catch (err) {
        console.error(
          "Open shared folder error:",
          err
        );

        setError(
          getErrorMessage(
            err,
            "Could not open the shared folder."
          )
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    setFolderPath((prev) => [
      ...prev,
      {
        id: folder.id,
        name: folder.name,
      },
    ]);

    setCurrentFolderId(folder.id);
    setCurrentPage("drive");
  }

  function goBackToRoot() {
    setFolderPath([]);
    setCurrentFolderId(null);
    setSharedFolderId(null);
    setCurrentPage("drive");
  }

  function goToBreadcrumb(index) {
    if (sharedFolderId !== null) {
      setError(
        "Navigation inside shared folders is limited to the current shared folder."
      );
      return;
    }

    const newPath = folderPath.slice(0, index + 1);

    setFolderPath(newPath);

    if (newPath.length === 0) {
      setCurrentFolderId(null);
    } else {
      setCurrentFolderId(
        newPath[newPath.length - 1].id
      );
    }

    setCurrentPage("drive");
  }

  function goUpOneLevel() {
    if (folderPath.length === 0) {
      return;
    }

    if (sharedFolderId !== null) {
      goBackToRoot();
      return;
    }

    const newPath = folderPath.slice(0, -1);

    setFolderPath(newPath);

    if (newPath.length === 0) {
      setCurrentFolderId(null);
    } else {
      setCurrentFolderId(
        newPath[newPath.length - 1].id
      );
    }
  }

  async function handleUpload(event) {
    const selectedFile =
      event.target.files?.[0] ||
      event.dataTransfer?.files?.[0];

    if (!selectedFile) {
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const params =
        currentFolderId === null
          ? {}
          : { folder_id: currentFolderId };

      await api.post(
        "/files/upload",
        formData,
        {
          params,
        }
      );

      await loadData();
    } catch (err) {
      console.error("Upload error:", err);

      setError(
        getErrorMessage(
          err,
          "Upload failed. Please try again."
        )
      );
    } finally {
      setUploading(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleCreateFolder() {
    if (sharedFolderId !== null) {
      setError(
        "You cannot create folders inside a shared folder yet."
      );
      return;
    }

    const folderName = window.prompt(
      "Enter folder name:"
    );

    if (folderName === null) {
      return;
    }

    const name = folderName.trim();

    if (!name) {
      setError("Folder name cannot be empty.");
      return;
    }

    try {
      setCreatingFolder(true);
      setError("");

      await api.post("/folders", {
        name,
        parent_id: currentFolderId,
      });

      await loadData();
    } catch (err) {
      console.error(
        "Create folder error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not create folder."
        )
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRestoreFile(fileId) {
    try {
      setError("");

      await api.patch(
        `/files/${fileId}/restore`
      );

      await loadData();
    } catch (err) {
      console.error(
        "Restore file error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not restore file."
        )
      );
    }
  }

  async function handleRestoreFolder(folderId) {
    try {
      setError("");

      await api.patch(
        `/folders/${folderId}/restore`
      );

      await loadData();
    } catch (err) {
      console.error(
        "Restore folder error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not restore folder."
        )
      );
    }
  }

  async function handleDelete(item, type) {
    if (sharedFolderId !== null) {
      setError(
        "You cannot delete items from a shared folder here."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.name}"? You can restore it from Trash later.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      if (type === "file") {
        await api.delete(`/files/${item.id}`);
      } else {
        await api.delete(`/folders/${item.id}`);
      }

      await loadData();
    } catch (err) {
      console.error("Delete error:", err);

      setError(
        getErrorMessage(
          err,
          "Could not delete this item."
        )
      );
    }
  }

  async function handleRename(item, type) {
    if (sharedFolderId !== null) {
      setError(
        "You cannot rename items inside a shared folder here."
      );
      return;
    }

    const currentName = item.name || "";

    const newName = window.prompt(
      "Enter new name:",
      currentName
    );

    if (newName === null) {
      return;
    }

    const name = newName.trim();

    if (!name) {
      setError("Name cannot be empty.");
      return;
    }

    try {
      setError("");

      if (type === "file") {
        await api.patch(
          `/files/${item.id}/rename`,
          null,
          {
            params: {
              name,
            },
          }
        );
      } else {
        await api.patch(
          `/folders/${item.id}/rename`,
          null,
          {
            params: {
              name,
            },
          }
        );
      }

      await loadData();
    } catch (err) {
      console.error("Rename error:", err);

      setError(
        getErrorMessage(
          err,
          "Could not rename this item."
        )
      );
    }
  }

  async function handleToggleStar(item, type) {
    if (sharedFolderId !== null) {
      setError(
        "You cannot star items inside a shared folder here."
      );
      return;
    }

    try {
      setError("");

      if (type === "file") {
        const starred = isFileStarred(item.id);

        if (starred) {
          await api.delete(
            `/files/${item.id}/star`
          );
        } else {
          await api.post(
            `/files/${item.id}/star`
          );
        }
      } else {
        const starred = isFolderStarred(item.id);

        if (starred) {
          await api.delete(
            `/folders/${item.id}/star`
          );
        } else {
          await api.post(
            `/folders/${item.id}/star`
          );
        }
      }

      await loadData();
    } catch (err) {
      console.error(
        "Star error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not update star."
        )
      );
    }
  }

  function isFileStarred(fileId) {
    return starredFiles.some(
      (file) => file.id === fileId
    );
  }

  function isFolderStarred(folderId) {
    return starredFolders.some(
      (folder) => folder.id === folderId
    );
  }

  function openShare(item, type) {
    if (sharedFolderId !== null) {
      setError(
        "You cannot share items from this shared folder here."
      );
      return;
    }

    setShareItem({
      id: item.id,
      name: item.name,
      resource_type: type,
    });

    setShareEmail("");
    setShareRole("viewer");
    setPublicLink("");
    setError("");
    setShowShareModal(true);
  }

  async function handleShare() {
    if (!shareItem) {
      return;
    }

    const email = shareEmail.trim();

    if (!email) {
      setError(
        "Please enter an email address."
      );
      return;
    }

    try {
      setSharing(true);
      setError("");

      await api.post("/shares", {
        resource_type:
          shareItem.resource_type,
        resource_id: shareItem.id,
        shared_with_email: email,
        role: shareRole,
      });

      setShowShareModal(false);
      setShareEmail("");
      setShareItem(null);

      window.alert(
        "Shared successfully!"
      );

      await loadData();
    } catch (err) {
      console.error(
        "Share error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not share this item."
        )
      );
    } finally {
      setSharing(false);
    }
  }

  async function handleCreatePublicLink() {
    if (!shareItem) {
      return;
    }

    try {
      setCreatingLink(true);
      setError("");
      setPublicLink("");

      const response = await api.post(
        "/public-link",
        {
          resource_type:
            shareItem.resource_type,
          resource_id: shareItem.id,
          expires_in_hours: 24,
        }
      );

      const token = response.data?.token;

      if (!token) {
        throw new Error(
          "Public link token was not returned."
        );
      }

      const link = `${window.location.origin}/public/${token}`;

      setPublicLink(link);
    } catch (err) {
      console.error(
        "Create public link error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not create public link."
        )
      );
    } finally {
      setCreatingLink(false);
    }
  }

  async function openSharedItem(item) {
    try {
      setError("");
      setLoading(true);

      if (
        item.resource_type ===
        "file"
      ) {
        await handleDownload(
          item.resource_id
        );
        return;
      }

      const response = await api.get(
        `/shared/folders/${item.resource_id}`
      );

      const data = response.data || {};

      setFiles(
        Array.isArray(data.files)
          ? data.files
          : []
      );

      setFolders(
        Array.isArray(data.folders)
          ? data.folders
          : []
      );

      setSharedFolderId(
        item.resource_id
      );

      setCurrentFolderId(
        item.resource_id
      );

      setCurrentPage("drive");

      setFolderPath([
        {
          id: item.resource_id,
          name:
            data.folder?.name ||
            item.name ||
            "Shared folder",
        },
      ]);
    } catch (err) {
      console.error(
        "Open shared item error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not open the shared folder."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(fileId) {
    try {
      setError("");

      const response = await api.get(
        `/files/${fileId}/download`
      );

      const downloadUrl =
        response.data?.download_url;

      if (!downloadUrl) {
        throw new Error(
          "Download URL was not returned."
        );
      }

      const link =
        document.createElement("a");

      link.href = downloadUrl;
      link.target = "_blank";
      link.rel =
        "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(
        "Download error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Could not download the file."
        )
      );
    }
  }

  function getFileIcon(filename) {
    if (!filename) {
      return <File size={22} />;
    }

    const extension =
      filename
        .split(".")
        .pop()
        ?.toLowerCase();

    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
      ].includes(extension)
    ) {
      return (
        <ImageIcon size={22} />
      );
    }

    if (
      [
        "pdf",
        "doc",
        "docx",
        "txt",
      ].includes(extension)
    ) {
      return (
        <FileText size={22} />
      );
    }

    return <File size={22} />;
  }

  function formatSize(bytes) {
    if (!bytes) {
      return "0 B";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    if (
      bytes <
      1024 * 1024 * 1024
    ) {
      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }

  function logout() {
    localStorage.removeItem(
      "token"
    );

    window.location.href =
      "/login";
  }

  const searchText =
    search.toLowerCase();

  const filteredFiles =
    files.filter(
      (file) =>
        file.name &&
        file.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredFolders =
    folders.filter(
      (folder) =>
        folder.name &&
        folder.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredTrashFiles =
    trashFiles.filter(
      (file) =>
        file.name &&
        file.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredTrashFolders =
    trashFolders.filter(
      (folder) =>
        folder.name &&
        folder.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredStarredFiles =
    starredFiles.filter(
      (file) =>
        file.name &&
        file.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredStarredFolders =
    starredFolders.filter(
      (folder) =>
        folder.name &&
        folder.name
          .toLowerCase()
          .includes(searchText)
    );

  const filteredSharedItems =
    sharedItems.filter(
      (item) =>
        item.name &&
        item.name
          .toLowerCase()
          .includes(searchText)
    );

  function renderBreadcrumb() {
    if (folderPath.length === 0) {
      return null;
    }

    return (
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <button
          type="button"
          onClick={goUpOneLevel}
          className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-[#6d5dfc] hover:bg-[#f0edff]"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <span className="text-gray-300">
          |
        </span>

        <button
          type="button"
          onClick={goBackToRoot}
          className="hover:text-[#6d5dfc]"
        >
          My Drive
        </button>

        {folderPath.map(
          (crumb, index) => (
            <span
              key={`crumb-${crumb.id}`}
              className="flex items-center gap-2"
            >
              <span className="text-gray-300">
                /
              </span>

              <button
                type="button"
                onClick={() =>
                  goToBreadcrumb(
                    index
                  )
                }
                className="hover:text-[#6d5dfc]"
              >
                {crumb.name}
              </button>
            </span>
          )
        )}
      </div>
    );
  }

  function renderCardActions(
    item,
    type
  ) {
    const starred =
      type === "file"
        ? isFileStarred(item.id)
        : isFolderStarred(item.id);

    return (
      <div
        className="flex items-center gap-2"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {type === "file" && (
          <button
            type="button"
            onClick={() =>
              handleDownload(item.id)
            }
            title="Download"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-[#6d5dfc]"
          >
            <Download size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            handleToggleStar(
              item,
              type
            )
          }
          title={
            starred
              ? "Unstar"
              : "Star"
          }
          className="rounded-lg p-1 hover:bg-gray-100"
        >
          <Star
            size={18}
            className={
              starred
                ? "fill-[#e69b26] text-[#e69b26]"
                : "text-gray-400 hover:text-[#e69b26]"
            }
          />
        </button>

        <button
          type="button"
          onClick={() =>
            openShare(
              item,
              type
            )
          }
          title="Share"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-[#6d5dfc]"
        >
          <Share2 size={18} />
        </button>

        <button
          type="button"
          onClick={() =>
            handleRename(
              item,
              type
            )
          }
          title="Rename"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-[#6d5dfc]"
        >
          ✎
        </button>

        <button
          type="button"
          onClick={() =>
            handleDelete(
              item,
              type
            )
          }
          title="Delete"
          className="rounded-lg p-1"
        >
          <Trash2
            size={18}
            className="text-gray-400 hover:text-red-500"
          />
        </button>
      </div>
    );
  }

  function renderDrive() {
    return (
      <>
        {renderBreadcrumb()}

        <section className="mb-10 grid grid-cols-3 gap-5">
          {!sharedFolderId && (
            <>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (!uploading) {
                    handleUpload(event);
                  }
                }}
                className="cursor-pointer rounded-3xl border-2 border-dashed border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#6d5dfc] hover:shadow-md"
              >
                <label className="block cursor-pointer">
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
                    {uploading
                      ? "Uploading..."
                      : "Upload files"}
                  </h3>

                  <p className="mt-1 text-sm text-gray-400">
                    Drag & drop files here or click to browse
                  </p>
                </label>
              </div>

              <button
                type="button"
                onClick={
                  handleCreateFolder
                }
                disabled={
                  creatingFolder
                }
                className="rounded-3xl border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
                  <Folder size={22} />
                </div>

                <h3 className="font-semibold">
                  {creatingFolder
                    ? "Creating..."
                    : "New folder"}
                </h3>

                <p className="mt-1 text-sm text-gray-400">
                  Organize your files
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowShareModal(
                    true
                  );
                  setShareItem(null);
                  setPublicLink("");
                  setError("");
                }}
                className="rounded-3xl border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f8f0] text-[#38a169]">
                  <Share2 size={22} />
                </div>

                <h3 className="font-semibold">
                  Share something
                </h3>

                <p className="mt-1 text-sm text-gray-400">
                  Select a file below to share
                </p>
              </button>
            </>
          )}
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {sharedFolderId
                  ? "Shared folder contents"
                  : "Your files"}
              </h3>

              <p className="text-sm text-gray-400">
                {files.length} files ·{" "}
                {folders.length} folders
              </p>
            </div>

            <div className="flex rounded-xl border border-black/5 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setView("grid")
                }
                className="rounded-lg p-2"
                title="Grid view"
              >
                <Grid2X2 size={17} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setView("list")
                }
                className="rounded-lg p-2"
                title="List view"
              >
                <List size={17} />
              </button>
            </div>
          </div>

          {filteredFiles.length === 0 &&
            filteredFolders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0edff] text-[#6d5dfc]">
                <Cloud size={30} />
              </div>

              <h3 className="mb-2 text-lg font-bold">
                This folder is empty
              </h3>

              <p className="mx-auto max-w-md text-sm text-gray-400">
                {sharedFolderId
                  ? "There are no files or folders inside this shared folder."
                  : "Upload a file or create a folder to start building your CloudDrive."}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-4 gap-5">
              {filteredFolders.map(
                (folder) => (
                  <div
                    key={`folder-${folder.id}`}
                    className="cursor-pointer rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    onClick={() =>
                      openFolder(
                        folder
                      )
                    }
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
                        <Folder size={22} />
                      </div>

                      {!sharedFolderId &&
                        renderCardActions(
                          folder,
                          "folder"
                        )}
                    </div>

                    <h4 className="truncate text-sm font-semibold">
                      {folder.name}
                    </h4>

                    <p className="mt-1 text-xs text-gray-400">
                      Folder
                    </p>
                  </div>
                )
              )}

              {filteredFiles.map(
                (file) => (
                  <div
                    key={`file-${file.id}`}
                    className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
                        {getFileIcon(
                          file.name
                        )}
                      </div>

                      {sharedFolderId ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleDownload(
                              file.id
                            )
                          }
                          className="rounded-xl px-3 py-2 text-xs font-semibold text-[#6d5dfc] hover:bg-[#f0edff]"
                        >
                          Download
                        </button>
                      ) : (
                        renderCardActions(
                          file,
                          "file"
                        )
                      )}
                    </div>

                    <h4 className="truncate text-sm font-semibold">
                      {file.name}
                    </h4>

                    <p className="mt-1 text-xs text-gray-400">
                      {formatSize(
                        file.size
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
              <div className="grid grid-cols-[1fr_160px_100px] border-b border-gray-100 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <span>Name</span>
                <span>Size</span>
                <span></span>
              </div>

              {filteredFolders.map(
                (folder) => (
                  <div
                    key={`folder-list-${folder.id}`}
                    className="grid cursor-pointer grid-cols-[1fr_160px_100px] items-center border-b border-gray-50 px-6 py-4 hover:bg-gray-50"
                    onClick={() =>
                      openFolder(
                        folder
                      )
                    }
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

                    {!sharedFolderId &&
                      renderCardActions(
                        folder,
                        "folder"
                      )}
                  </div>
                )
              )}

              {filteredFiles.map(
                (file) => (
                  <div
                    key={`file-list-${file.id}`}
                    className="grid grid-cols-[1fr_160px_100px] items-center border-b border-gray-50 px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#6d5dfc]">
                        {getFileIcon(
                          file.name
                        )}
                      </span>

                      <span className="text-sm font-medium">
                        {file.name}
                      </span>
                    </div>

                    <span className="text-sm text-gray-400">
                      {formatSize(
                        file.size
                      )}
                    </span>

                    {sharedFolderId ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleDownload(
                            file.id
                          )
                        }
                        className="text-xs font-semibold text-[#6d5dfc]"
                      >
                        Download
                      </button>
                    ) : (
                      renderCardActions(
                        file,
                        "file"
                      )
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </>
    );
  }

  function renderTrash() {
    return (
      <section>
        <div className="mb-6">
          <h3 className="text-2xl font-bold">
            Trash
          </h3>

          <p className="mt-1 text-sm text-gray-400">
            Deleted files and folders
          </p>
        </div>

        {filteredTrashFiles.length === 0 &&
          filteredTrashFolders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <Trash2
              size={40}
              className="mx-auto mb-4 text-gray-300"
            />

            <h3 className="text-lg font-bold">
              Trash is empty
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Deleted items will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-5">
            {filteredTrashFolders.map(
              (folder) => (
                <div
                  key={`trash-folder-${folder.id}`}
                  className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
                      <Folder size={22} />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRestoreFolder(
                          folder.id
                        )
                      }
                      className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-[#6d5dfc]"
                      title="Restore"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>

                  <h4 className="truncate text-sm font-semibold">
                    {folder.name}
                  </h4>

                  <p className="mt-1 text-xs text-gray-400">
                    Deleted folder
                  </p>
                </div>
              )
            )}

            {filteredTrashFiles.map(
              (file) => (
                <div
                  key={`trash-file-${file.id}`}
                  className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
                      {getFileIcon(
                        file.name
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRestoreFile(
                          file.id
                        )
                      }
                      className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-[#6d5dfc]"
                      title="Restore"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>

                  <h4 className="truncate text-sm font-semibold">
                    {file.name}
                  </h4>

                  <p className="mt-1 text-xs text-gray-400">
                    {formatSize(
                      file.size
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </section>
    );
  }

  function renderStarred() {
    return (
      <section>
        <div className="mb-6">
          <h3 className="text-2xl font-bold">
            Starred
          </h3>

          <p className="mt-1 text-sm text-gray-400">
            Your starred files and folders
          </p>
        </div>

        {filteredStarredFiles.length === 0 &&
          filteredStarredFolders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <Star
              size={40}
              className="mx-auto mb-4 text-gray-300"
            />

            <h3 className="text-lg font-bold">
              No starred items
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Star a file or folder to find it here quickly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-5">
            {filteredStarredFolders.map(
              (folder) => (
                <div
                  key={`starred-folder-${folder.id}`}
                  className="cursor-pointer rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  onClick={() =>
                    openFolder(
                      folder
                    )
                  }
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4df] text-[#e69b26]">
                      <Folder size={22} />
                    </div>

                    {renderCardActions(
                      folder,
                      "folder"
                    )}
                  </div>

                  <h4 className="truncate text-sm font-semibold">
                    {folder.name}
                  </h4>

                  <p className="mt-1 text-xs text-gray-400">
                    Folder
                  </p>
                </div>
              )
            )}

            {filteredStarredFiles.map(
              (file) => (
                <div
                  key={`starred-file-${file.id}`}
                  className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
                      {getFileIcon(
                        file.name
                      )}
                    </div>

                    {renderCardActions(
                      file,
                      "file"
                    )}
                  </div>

                  <h4 className="truncate text-sm font-semibold">
                    {file.name}
                  </h4>

                  <p className="mt-1 text-xs text-gray-400">
                    {formatSize(
                      file.size
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </section>
    );
  }

  function renderShared() {
    return (
      <section>
        <div className="mb-6">
          <h3 className="text-2xl font-bold">
            Shared with me
          </h3>

          <p className="mt-1 text-sm text-gray-400">
            Files and folders other users have shared with you
          </p>
        </div>

        {filteredSharedItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <Share2
              size={40}
              className="mx-auto mb-4 text-gray-300"
            />

            <h3 className="text-lg font-bold">
              Nothing shared with you
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Files shared with your account will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-5">
            {filteredSharedItems.map(
              (item) => (
                <div
                  key={`shared-${item.id}`}
                  className="cursor-pointer rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  onClick={() =>
                    openSharedItem(
                      item
                    )
                  }
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f8f0] text-[#38a169]">
                      {item.resource_type ===
                        "folder" ? (
                        <Folder size={22} />
                      ) : (
                        getFileIcon(
                          item.name
                        )
                      )}
                    </div>

                    <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#6253e8]">
                      {item.role ||
                        "viewer"}
                    </span>
                  </div>

                  <h4 className="truncate text-sm font-semibold">
                    {item.name ||
                      "Shared item"}
                  </h4>

                  <p className="mt-1 text-xs text-gray-400">
                    {item.resource_type ===
                      "folder"
                      ? "Shared folder"
                      : formatSize(
                        item.size
                      )}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </section>
    );
  }

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
          onClick={
            handleCreateFolder
          }
          disabled={
            creatingFolder
          }
          className="mb-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6d5dfc] px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-[#5e4ee8] disabled:opacity-50"
        >
          <Plus size={19} />

          {creatingFolder
            ? "Creating..."
            : "New folder"}
        </button>

        <nav className="space-y-2">
          <button
            type="button"
            onClick={() => {
              goBackToRoot();
            }}
            className={
              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold " +
              (currentPage ===
                "drive"
                ? "bg-[#f0edff] text-[#6253e8]"
                : "text-gray-500 hover:bg-gray-50")
            }
          >
            <HardDrive size={18} />
            My Drive
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(
                "shared"
              );
              setSharedFolderId(
                null
              );
              setCurrentFolderId(
                null
              );
              setFolderPath([]);
            }}
            className={
              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm " +
              (currentPage ===
                "shared"
                ? "bg-[#f0edff] font-semibold text-[#6253e8]"
                : "text-gray-500 hover:bg-gray-50")
            }
          >
            <Share2 size={18} />
            Shared with me
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(
                "starred"
              );
              setSharedFolderId(
                null
              );
              setCurrentFolderId(
                null
              );
              setFolderPath([]);
            }}
            className={
              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm " +
              (currentPage ===
                "starred"
                ? "bg-[#f0edff] font-semibold text-[#6253e8]"
                : "text-gray-500 hover:bg-gray-50")
            }
          >
            <Star size={18} />
            Starred
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(
                "trash"
              );
              setSharedFolderId(
                null
              );
              setCurrentFolderId(
                null
              );
              setFolderPath([]);
            }}
            className={
              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm " +
              (currentPage ===
                "trash"
                ? "bg-[#f0edff] font-semibold text-[#6253e8]"
                : "text-gray-500 hover:bg-gray-50")
            }
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
              {currentPage ===
                "trash"
                ? "Trash"
                : currentPage ===
                  "shared"
                  ? "Shared with me"
                  : currentPage ===
                    "starred"
                    ? "Starred"
                    : folderPath.length >
                      0
                      ? folderPath[
                        folderPath.length -
                        1
                      ].name
                      : "My Drive"}
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
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <span>
              {String(error)}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-4 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#6d5dfc]" />

            <p className="text-sm text-gray-400">
              Loading your files...
            </p>
          </div>
        ) : currentPage ===
          "trash" ? (
          renderTrash()
        ) : currentPage ===
          "starred" ? (
          renderStarred()
        ) : currentPage ===
          "shared" ? (
          renderShared()
        ) : (
          renderDrive()
        )}
      </main>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  Share
                </h3>

                {shareItem && (
                  <p className="mt-1 truncate text-sm text-gray-400">
                    {shareItem.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowShareModal(
                    false
                  );
                  setShareItem(null);
                  setPublicLink("");
                  setError("");
                }}
                className="rounded-xl p-2 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {!shareItem ? (
              <div>
                <p className="mb-4 text-sm text-gray-500">
                  Choose a file or folder from
                  your Drive using its Share icon.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowShareModal(
                      false
                    )
                  }
                  className="w-full rounded-2xl bg-[#6d5dfc] px-4 py-3 font-semibold text-white"
                >
                  Choose from Drive
                </button>
              </div>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold">
                  Email address
                </label>

                <input
                  type="email"
                  value={shareEmail}
                  onChange={(event) =>
                    setShareEmail(
                      event.target.value
                    )
                  }
                  placeholder="friend@example.com"
                  className="mb-5 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#6d5dfc]"
                />

                <label className="mb-2 block text-sm font-semibold">
                  Permission
                </label>

                <select
                  value={shareRole}
                  onChange={(event) =>
                    setShareRole(
                      event.target.value
                    )
                  }
                  className="mb-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none"
                >
                  <option value="viewer">
                    Viewer
                  </option>

                  <option value="editor">
                    Editor
                  </option>
                </select>

                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="w-full rounded-2xl bg-[#6d5dfc] px-4 py-3 font-semibold text-white transition hover:bg-[#5e4ee8] disabled:opacity-50"
                >
                  {sharing
                    ? "Sharing..."
                    : "Share"}
                </button>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />

                  <span className="text-xs text-gray-400">
                    OR
                  </span>

                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={
                    handleCreatePublicLink
                  }
                  disabled={
                    creatingLink
                  }
                  className="w-full rounded-2xl border border-[#6d5dfc] px-4 py-3 font-semibold text-[#6d5dfc] transition hover:bg-[#f0edff] disabled:opacity-50"
                >
                  {creatingLink
                    ? "Creating link..."
                    : "Create public link"}
                </button>

                {publicLink && (
                  <div className="mt-4 rounded-2xl bg-[#f7f7fb] p-4">
                    <p className="mb-2 text-xs font-semibold text-gray-500">
                      Public link
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={
                          publicLink
                        }
                        readOnly
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none"
                      />

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(publicLink);
                            window.alert("Link copied!");
                          } catch (err) {
                            console.error("Copy error:", err);
                            setError("Could not copy the link.");
                          }
                        }}
                        className="rounded-xl bg-[#6d5dfc] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;