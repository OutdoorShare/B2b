import { useEffect } from "react";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { applyBrandColors } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  useEffect(() => {
    if (profile) {
      applyBrandColors(profile.primaryColor, profile.accentColor);
    }
  }, [profile?.primaryColor, profile?.accentColor]);

  return <>{children}</>;
}
