import { Routes, Route } from "react-router";
import AuthLayout from "@/components/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Library from "./pages/Library";
import Assistant from "./pages/Assistant";
import Files from "./pages/Files";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <AuthLayout>
              <Dashboard />
            </AuthLayout>
          }
        />
        <Route
          path="/catalog"
          element={
            <AuthLayout>
              <Catalog />
            </AuthLayout>
          }
        />
        <Route
          path="/library"
          element={
            <AuthLayout>
              <Library />
            </AuthLayout>
          }
        />
        <Route
          path="/assistant"
          element={
            <AuthLayout>
              <Assistant />
            </AuthLayout>
          }
        />
        <Route
          path="/files"
          element={
            <AuthLayout>
              <Files />
            </AuthLayout>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="bottom-right" theme="dark" />
    </>
  );
}
