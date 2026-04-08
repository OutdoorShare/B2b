import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function StorefrontProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(`${BASE}/${slug}/my-bookings?tab=settings`, { replace: true });
  }, [slug]);

  return null;
}
