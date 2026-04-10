import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: April 2025</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us when you create an account, make a
              booking, or communicate with us. This may include your name, email address, phone number,
              payment information, and government-issued ID when required for age verification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to process bookings, verify your identity, send
              booking confirmations and reminders, provide customer support, and comply with legal
              obligations. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Payment Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              All payment processing is handled by Stripe, Inc. We do not store your full credit card
              number, CVV, or other sensitive payment details on our servers. Stripe's privacy policy
              governs the handling of your payment information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Sharing Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may share your information with the rental business you book with (the tenant on our
              platform), as they need your contact and booking details to fulfill the rental. We may
              also share information when required by law or to protect our rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to
              provide services, comply with legal obligations, resolve disputes, and enforce our
              agreements. You may request deletion of your account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies for authentication and to remember your
              preferences. Session cookies are essential for the platform to function and are
              deleted when you log out or close your browser.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the right to access, correct, or delete the
              personal information we hold about you, or to object to or restrict certain processing.
              To exercise these rights, contact us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or how we handle your data, please
              contact us at{" "}
              <a href="mailto:privacy@myoutdoorshare.com" className="text-primary underline">
                privacy@myoutdoorshare.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
