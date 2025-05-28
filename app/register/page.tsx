  "use client"

  import { useState, useEffect } from "react"
  import Link from "next/link"
  import { useRouter, useSearchParams } from "next/navigation"
  import { Shield, Eye, EyeOff, AlertCircle } from "lucide-react"
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
  import { Logoglitch } from "@/components/ui/logoglitch"
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
  import { signIn } from "next-auth/react"


import { Suspense } from 'react'
import { Metadata } from 'next'
import '../../app/globals.css'


export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {

  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [usernameError, setUsernameError] = useState("")
  const [usernameSet, setUsernameSet] = useState(false)

  // Username validation regex: a-z, A-Z, 0-9, underscore, period; 3-20 characters
  const usernameRegex = /^[a-zA-Z0-9_.]{3,20}$/

  useEffect(() => {
    if (password && confirmPassword) {
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match")
      } else if (password.length < 8) {
        setPasswordError("Password must be at least 8 characters")
      } else {
        setPasswordError("")
      }
    } else {
      setPasswordError("")
    }
  }, [password, confirmPassword])

  const handleRegister = async () => {
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (passwordError) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      setShowUsernameModal(true)
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err && typeof (err as any).message === "string"
          ? (err as any).message
          : "Registration failed"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleUsernameSubmit = async () => {
    if (!username) {
      setUsernameError("Username is required")
      return
    }

    if (!usernameRegex.test(username)) {
      setUsernameError(
        "Username must be 3-20 characters and contain only letters, numbers, underscores, or periods"
      )
      return
    }

    setIsLoading(true)
    setUsernameError("")

    try {
      const checkResponse = await fetch(`/api/auth/check-username?username=${username.toLowerCase()}`)
      const checkData = await checkResponse.json()

      if (checkData.exists) {
        setUsernameError("Username already taken")
        return
      }

      const updateResponse = await fetch("/api/auth/update-username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, username: username.toLowerCase() }),
      })

      if (!updateResponse.ok) {
        throw new Error("Failed to update username")
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      setUsernameSet(true)
      setShowUsernameModal(false)
      router.push(callbackUrl)
    } catch (err) {
      setUsernameError(
        err && typeof err === "object" && "message" in err && typeof (err as any).message === "string"
          ? (err as any).message
          : "Failed to set username"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!usernameSet) {
      setShowUsernameModal(true)
    } else {
      setShowUsernameModal(open)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black p-4">
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      <div className="relative w-full max-w-md mx-auto">
        <Card className="w-full border-gray-800 bg-black/80 backdrop-blur-md">
          <CardHeader className="space-y-1 text-center">
            <Logoglitch className="mx-auto h-[80px] w-auto text-white" />
            <CardTitle className="text-2xl font-bold gradient-text text-gray-400">Create an account</CardTitle>
            <CardDescription className="text-gray-400">Enter your information to create your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center justify-center text-red-500 text-sm p-2 bg-red-500/10 rounded-md">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-300">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                className="bg-gray-900/70 border-gray-800 focus:border-blue-600 hover-input text-gray-300"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="bg-gray-900/70 border-gray-800 focus:border-blue-600 hover-input text-gray-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-gray-900/70 border-gray-800 focus:border-blue-600 pr-10 hover-input text-gray-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`bg-gray-900/70 border-gray-800 focus:border-blue-600 pr-10 hover-input text-gray-300 ${
                    passwordError ? "border-red-500" : ""
                  }`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span>
                </button>
              </div>
              {passwordError && (
                <div className="flex items-center text-red-500 text-xs mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              className="w-full gradient-btn button-hover"
              disabled={!!passwordError || isLoading}
              onClick={handleRegister}
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
            <div className="text-center text-sm text-gray-400">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-500 hover:text-blue-400 hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Username Setup Modal */}
      <Dialog open={showUsernameModal} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-800 [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-white">Choose a Username</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose a unique username to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-300">
                Username
              </label>
              <Input
                id="username"
                type="text"
                placeholder="coolusername"
                className="bg-gray-800 border-gray-700 focus:border-blue-600 text-gray-300 hover-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {usernameError && (
                <p className="text-red-500 text-xs mt-1">{usernameError}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              className="gradient-btn button-hover"
              onClick={handleUsernameSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}