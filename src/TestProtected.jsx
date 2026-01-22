import { useEffect } from "react";
import api from "./api/axios";

function TestProtected() {

  useEffect(() => {
    api.get("/medicines") // protected endpoint
      .then(res => {
        console.log("✅ SUCCESS:", res.data);
      })
      .catch(err => {
        console.error("❌ ERROR:", err);
      });
  }, []);

  return <h2>Testing Protected API...</h2>;
}

export default TestProtected;
