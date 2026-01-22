import { createRoute } from "honox/factory";
import SignupForm from "@/islands/signup-form";

export default createRoute((c) => {
	return c.render(<SignupForm />);
});
