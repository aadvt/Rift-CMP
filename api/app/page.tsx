import { redirect } from "next/navigation";

/** The root is the dashboard; the guard there sends signed-out users to sign in. */
export default function Home() {
  redirect("/dashboard");
}
