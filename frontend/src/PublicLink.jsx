
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "./api";

function PublicLink() {
  const { token } = useParams();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPublicItem() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/public/${token}`
        );

        setItem(response.data);
      } catch (err) {
        console.error(
          "Public link error:",
          err
        );

        setError(
          err?.response?.data?.detail ||
          "Could not open this public link."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPublicItem();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#6d5dfc]" />

          <p className="text-sm text-gray-400">
            Loading public file...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold">
            Link unavailable
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eeeaff] text-[#6d5dfc]">
          📄
        </div>

        <h1 className="text-2xl font-bold">
          {item.name}
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          Publicly shared file
        </p>

        {item.type === "file" && (
          <a
            href={item.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block rounded-2xl bg-[#6d5dfc] px-4 py-3 font-semibold text-white transition hover:bg-[#5e4ee8]"
          >
            Download file
          </a>
        )}
      </div>
    </div>
  );
}

export default PublicLink;

