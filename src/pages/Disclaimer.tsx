import { ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Disclaimer = () => (
  <div className="editorial-shell">
    <header className="editorial-nav">
      <div className="editorial-container flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 font-serif text-3xl">
          <Home className="h-5 w-5 text-primary" strokeWidth={1.5} />
          Buyer Sync
        </Link>
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Back</Link></Button>
      </div>
    </header>

    <main className="editorial-container py-12 md:py-20">
      <article className="mx-auto max-w-4xl">
        <p className="eyebrow">Legal information</p>
        <h1 className="display-title mt-4">Disclaimer, Privacy &amp; Terms of Use</h1>
        <p className="mt-5 text-sm text-muted-foreground">Effective September 4, 2026</p>
        <p className="mt-8 border-l-2 border-primary pl-5 text-base leading-7">
          Please read this page before using Buyer Sync. By accessing or using the site, you acknowledge these terms and disclosures. If you do not agree, do not use the site.
        </p>

        <div className="mt-12 space-y-10 text-sm leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-3xl [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-sans [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:tracking-normal [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <section>
            <h2>Purpose of Buyer Sync</h2>
            <p>Buyer Sync is a collaborative organization and decision-support tool for people considering homes. It helps users collect property information, share observations, compare preferences, and discuss decisions. It is not a real estate brokerage, lender, mortgage broker, appraiser, home inspector, insurer, attorney, tax adviser, financial adviser, credit-reporting agency, or government agency.</p>
          </section>

          <section>
            <h2>Information and professional advice disclaimer</h2>
            <p>Property details, imported listing information, maps, photos, estimated costs, scores, advertisements, mortgage rates, payment examples, assistance-program links, and other site content are provided for general educational and organizational purposes. They may be incomplete, delayed, inaccurate, unavailable, or changed without notice.</p>
            <p className="mt-3">Financing examples are not loan offers, approvals, rate locks, or guarantees. Actual rates, payments, eligibility, taxes, insurance, mortgage insurance, fees, credit decisions, and program availability depend on factors including credit history, credit score, income, debt, property, location, lender requirements, and market conditions. Rates and programs may change at any time. Verify all material information independently with the listing source and appropriately licensed professionals before making an offer, signing an agreement, spending money, or relying on a result.</p>
          </section>

          <section>
            <h2>Information we collect</h2>
            <p>Depending on how you use the site, Buyer Sync may collect or store:</p>
            <ul className="mt-3">
              <li>Account and authentication information, such as your name, email address, optional phone number or avatar, account role, encrypted password representation, and browser-stored sign-in token.</li>
              <li>Home-search content, including search names, invitations, property addresses and details, source links, photos, notes, ratings, preferences, checklists, inspection observations, comments, attachments, and decision criteria.</li>
              <li>Advertising information, including advertiser account details, campaign copy, uploaded creatives, destination links, schedules, review and invoice status, and aggregate impression and click counts.</li>
              <li>Technical and operational information supplied through requests to the service, such as request data needed to authenticate, secure, operate, troubleshoot, and prevent misuse of the site.</li>
            </ul>
            <p className="mt-3">Credit score, income, and debt values entered into the financing calculator are used in your browser to produce estimates and are not saved by Buyer Sync. Do not enter sensitive personal, financial, health, or confidential information into free-text fields.</p>
          </section>

          <section>
            <h2>How information is used</h2>
            <p>Information is used to create and secure accounts; provide searches, collaboration, comparisons, financing examples, invitations, uploads, and advertising features; show the identity and contributions of search participants; review and serve campaigns; measure ad performance; maintain and improve the service; diagnose errors; prevent fraud or abuse; enforce these terms; and comply with legal obligations.</p>
          </section>

          <section>
            <h2>Sharing and disclosure of personal data</h2>
            <h3>People you collaborate with</h3>
            <p>Content added to a shared home search may be visible to accepted buyers, co-buyers, agents, and other contributors in that search. Your name, role, contributions, ratings, notes, and activity associated with shared features may identify you to them. Only invite people you trust, and do not add another person’s personal data without permission.</p>
            <h3>Service providers and external services</h3>
            <p>Data may be processed by hosting, storage, security, mapping, property-information, communications, analytics, and other vendors used to operate the site. When you import a listing, open an outside link, load remote imagery, or interact with an advertisement, the external provider may receive technical information under its own privacy terms. Public mortgage benchmarks are obtained from third-party government or industry sources.</p>
            <h3>Advertising</h3>
            <p>Buyer Sync displays operator-reviewed campaigns and may use a configured contextual advertising network. Advertisers receive aggregate campaign impression and click counts, not the private contents of your home search through Buyer Sync’s campaign reporting. A third-party ad provider may independently collect device, request, cookie, or interaction data as described in that provider’s policies and any consent notice it supplies.</p>
            <h3>Legal and organizational disclosures</h3>
            <p>Information may be disclosed when reasonably necessary to comply with law or legal process; protect users, the public, rights, property, or site security; investigate misuse; or support a merger, financing, reorganization, sale, or transfer of all or part of the service, subject to applicable law. Buyer Sync does not currently sell personal information for money.</p>
          </section>

          <section>
            <h2>Data choices, retention, and security</h2>
            <p>You may choose not to provide optional information, avoid inviting collaborators, leave shared searches, and sign out to remove the active sign-in token from browser storage. Requests to access, correct, or delete account information are subject to identity verification, applicable law, technical limits, other users’ rights, and legitimate retention needs such as security, dispute resolution, and legal compliance.</p>
            <p className="mt-3">Information is retained for as long as reasonably needed to provide and protect the service and meet legal obligations. No storage or transmission method is completely secure. Keep your credentials confidential, use a secure device, and promptly report suspected unauthorized access through the contact method made available by the site operator.</p>
          </section>

          <section>
            <h2>Personal, non-commercial use</h2>
            <p>Buyer Sync’s buyer features are provided for your personal, lawful home-search use. You may not copy, scrape, resell, sublicense, reverse engineer, disrupt, overload, probe, bypass access controls, introduce malicious code, harvest data, impersonate another person, infringe rights, or use the site to make unlawful or discriminatory housing decisions. Advertiser use is limited to authorized campaign management and remains subject to review.</p>
            <p className="mt-3">The site design, software, branding, and original content are protected by applicable intellectual-property laws. Except for the limited right to use the service under these terms, no ownership rights are transferred to you.</p>
          </section>

          <section>
            <h2>Your content and responsibilities</h2>
            <p>You retain responsibility for content you submit. You confirm that you have the necessary rights and permissions to upload, share, and use it. You grant Buyer Sync a non-exclusive license to host, reproduce, process, and display that content only as needed to operate, secure, and improve the service. Do not upload unlawful, misleading, infringing, confidential, malicious, or harmful material.</p>
          </section>

          <section>
            <h2>Third-party links, listings, and advertisements</h2>
            <p>Links, imported content, advertisements, and references to third parties do not constitute endorsement or a guarantee. Buyer Sync does not control third-party availability, accuracy, security, products, services, transactions, or privacy practices. Your interactions with a property source, professional, advertiser, lender, government program, or other third party are solely between you and that party.</p>
          </section>

          <section>
            <h2>Availability, warranties, and limitation of liability</h2>
            <p>To the fullest extent permitted by law, the site is provided “as is” and “as available,” without warranties of accuracy, availability, merchantability, fitness for a particular purpose, title, or non-infringement. Buyer Sync does not guarantee that the service will be uninterrupted, error-free, secure, or suitable for a particular transaction.</p>
            <p className="mt-3">To the fullest extent permitted by law, Buyer Sync and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost data, lost profits, lost opportunities, property decisions, financing outcomes, or reliance on site content. Some jurisdictions do not allow certain exclusions, so portions of this section may not apply to you. Your non-waivable consumer rights remain unaffected.</p>
          </section>

          <section>
            <h2>Children and geographic availability</h2>
            <p>The site is intended for adults and is not directed to children under 13. Do not submit a child’s personal information. Buyer Sync may not be appropriate or available in every location, and users are responsible for following the laws that apply where they live and where a property is located.</p>
          </section>

          <section>
            <h2>Changes to this page</h2>
            <p>This page may be updated as the service, its data practices, or legal requirements change. The effective date above identifies the latest version. Continued use after an update means you acknowledge the revised terms to the extent permitted by law.</p>
          </section>
        </div>
      </article>
    </main>
  </div>
);

export default Disclaimer;