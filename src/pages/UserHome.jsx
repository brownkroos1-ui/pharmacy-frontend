import React from "react";
import ProtectedRoute from "../components/ProtectedRoute";

const UserHome = () => {
  return (
    <div>
      <h1>User Home</h1>
    </div>
  );
};

export default function ProtectedUserHome() {
  return (
    <ProtectedRoute allowedRoles={["USER"]}>
      <UserHome />
    </ProtectedRoute>
  );
}
