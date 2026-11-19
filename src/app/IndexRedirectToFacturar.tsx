import { Navigate, useLocation } from "react-router-dom";

export function IndexRedirectToFacturar() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/facturar", search }} replace />;
}
