import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="text-center">
        <div className="display text-7xl font-bold text-mustard-400">404</div>
        <h1 className="display text-2xl font-semibold mt-2">Page not found</h1>
        <p className="text-charcoal-400 mt-2">
          That page is not part of the care plan.
        </p>
        <Link to="/" className="btn-primary mt-5 inline-flex">
          Back home
        </Link>
      </div>
    </main>
  );
}
