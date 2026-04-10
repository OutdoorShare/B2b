import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: April 2025</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using OutdoorShare, you agree to be bound by these Terms of Service and
              our Privacy Policy. If you do not agree, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Use of the Platform</h2>
            <p className="text-muted-foreground leading-relaxed">
              OutdoorShare provides a technology platform that connects rental businesses with
              customers. We are not a party to any rental transaction and are not responsible for the
              condition, quality, or safety of any rental equipment listed on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old to create an account. You are responsible for
              maintaining the security of your account credentials and for all activities that occur
              under your account. Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Bookings and Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              Booking and cancellation policies are set by each individual rental business. Payments
              are processed securely through Stripe. Deposits may be collected at the time of booking
              and are subject to each business's refund policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Prohibited Uses</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may not use the platform for any unlawful purpose, to harass or harm others, to
              submit false or misleading information, or to interfere with the platform's operation.
              Violations may result in immediate account termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, OutdoorShare shall not be liable for
              any indirect, incidental, special, or consequential damages arising from your use of the
              platform or any rental transaction facilitated through it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of significant changes
              by email or by posting a notice on the platform. Continued use of the platform after
              changes take effect constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at{" "}
              <a href="mailto:legal@myoutdoorshare.com" className="text-primary underline">
                legal@myoutdoorshare.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
