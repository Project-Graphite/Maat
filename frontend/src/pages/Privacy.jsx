import Seo from '../components/Seo.jsx'

const CONTACT = __CONTACT_EMAIL__

export const Contact = () =>
  CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : <span>the operator of this site</span>

export default function Privacy() {
  return (
    <div className="page">
      <Seo
        title="Privacy policy"
        description="What personal data Ma’at collects, why, how long it is kept, and the rights you have over it."
        path="/privacy"
      />
      <article className="legal">
        <h1>Privacy policy</h1>
        <p className="muted">Last updated 24 October 2026</p>

        <p style={{ marginTop: 24 }}>
          Ma’at is an online judge. This page explains what personal data the site holds, why, and what you
          can do about it. The short version: we keep what the service needs to work and nothing for
          advertising or tracking.
        </p>

        <h2>Who is responsible</h2>
        <p>
          The site is run by its operator, who decides how your data is used. You can reach them through{' '}
          <Contact />.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details.</strong> Your name, your email address, and a password. The password is
            stored only as a salted hash, so nobody can read it, including us.
          </li>
          <li>
            <strong>Your photo,</strong> if you upload one. It is resized and stored with the rest of the
            site’s files. It is optional.
          </li>
          <li>
            <strong>Your submissions.</strong> The source code you send, the language, the time, and the
            verdict with the result of each test. This is the point of the service, so it is kept.
          </li>
          <li>
            <strong>Contest activity.</strong> Which contests you submitted to, and the scores that follow.
            Your name appears on a contest’s public standings.
          </li>
          <li>
            <strong>Technical data.</strong> Your IP address and the pages requested appear in server logs,
            and the API uses your IP address to limit how many requests one visitor can make.
          </li>
        </ul>

        <h2>Cookies and local storage</h2>
        <p>
          We set one cookie, <code>jwt</code>, to keep you logged in. It is marked HttpOnly, so scripts on
          the page cannot read it, and it is strictly necessary for logging in. Because of that, no cookie
          banner is needed.
        </p>
        <p>
          Your browser’s local storage holds your code drafts and your last chosen language, so a refresh does
          not lose your work. That data stays on your device and is never sent to us.
        </p>
        <p>
          There is no analytics, no advertising and no social media tracker on this site. Fonts and scripts
          are served from the site itself, so your browser does not contact any other company when you visit.
        </p>

        <h2>Why we use it</h2>
        <ul>
          <li>To run your account and let you log in, which is needed to provide the service you asked for.</li>
          <li>To judge your submissions, show your results, and rank contests.</li>
          <li>To email you a link when you ask to reset your password.</li>
          <li>To keep the site secure and stop abuse, which is our legitimate interest in running it safely.</li>
        </ul>

        <h2>Who else sees it</h2>
        <p>
          Your name and score are public on contest standings. Your source code is private to you and to the
          site’s administrators, who can open any submission to look into problems or cheating. We do not sell
          or share your data with advertisers. Hosting and email providers handle data on the operator’s
          behalf, only to deliver the service.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account data and submissions are kept while your account exists. Server logs are kept for a short
          time for security and troubleshooting. Password reset links expire quickly.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see the data we hold about you, correct it, receive a copy, have it deleted, or object
          to how it is used. You can already change your name, photo and password on your account page. For
          anything else, including deleting your account, write to <Contact />. If you are in the European
          Economic Area or the United Kingdom, you can also complain to your local data protection authority.
        </p>

        <h2>Children</h2>
        <p>
          Ma’at is not meant for children under 13, and we do not knowingly collect their data. If you think a
          child has signed up, contact us and we will remove the account.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes in a way that matters, we will update the date at the top of the page and, for
          large changes, tell logged-in users.
        </p>
      </article>
    </div>
  )
}
