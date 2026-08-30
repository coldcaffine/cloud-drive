import { useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "./api"

function Signup() {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSignup = async (e) => {
        e.preventDefault()

        setError("")
        setLoading(true)

        try {
            await api.post("/auth/register", {
                email,
                password,
            })

            navigate("/login")
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Could not create account. Please try again."
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4">

            <div className="w-full max-w-md">

                {/* Logo */}
                <div className="mb-8 text-center">

                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6d5dfc] text-xl font-bold text-white shadow-sm">
                        C
                    </div>

                    <h1 className="text-2xl font-bold text-[#172033]">
                        Create your account
                    </h1>

                    <p className="mt-2 text-sm text-[#8b91a3]">
                        Start using your CloudDrive
                    </p>

                </div>


                {/* Card */}
                <div className="rounded-3xl border border-[#e5e7ee] bg-white p-8 shadow-sm">

                    <form onSubmit={handleSignup} className="space-y-5">

                        {/* Email */}
                        <div>

                            <label className="mb-2 block text-sm font-semibold text-[#172033]">
                                Email
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full rounded-xl border border-[#e1e3ea] px-4 py-3 text-sm outline-none transition placeholder:text-[#a2a7b5] focus:border-[#a59cff] focus:ring-4 focus:ring-[#eeecff]"
                            />

                        </div>


                        {/* Password */}
                        <div>

                            <label className="mb-2 block text-sm font-semibold text-[#172033]">
                                Password
                            </label>

                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full rounded-xl border border-[#e1e3ea] px-4 py-3 text-sm outline-none transition placeholder:text-[#a2a7b5] focus:border-[#a59cff] focus:ring-4 focus:ring-[#eeecff]"
                            />

                        </div>


                        {/* Error */}
                        {error && (
                            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}


                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-[#6d5dfc] py-3 text-sm font-semibold text-white transition hover:bg-[#5c4de8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? "Creating account..." : "Create account"}
                        </button>

                    </form>


                    {/* Login */}
                    <p className="mt-6 text-center text-sm text-[#8b91a3]">

                        Already have an account?{" "}

                        <button
                            onClick={() => navigate("/login")}
                            className="font-semibold text-[#6d5dfc] hover:text-[#5c4de8]"
                        >
                            Sign in
                        </button>

                    </p>

                </div>

            </div>

        </div>
    )
}

export default Signup