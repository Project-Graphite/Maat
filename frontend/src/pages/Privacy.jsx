import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

const CONTACT = __CONTACT_EMAIL__

export const Contact = () => (CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : <span>us</span>)

export default function Privacy() {
  return (
    <div className="page">
      <Seo
        title="Privacy policy"
        description="What Ma’at keeps about you, why, for how long, and how to have it deleted."
        path="/privacy"
      />
      <article className="legal">
        <h1>Privacy policy</h1>
        <p className="muted">Last updated 27 October 2026</p>

        <p style={{ marginTop: 24 }}>
          This page explains what we keep about you when you use Ma’at, why, and what you can do about it. We
          only keep what the site needs to work. We never sell your data or use it for advertising.
        </p>

        <h2>What we keep</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, your email address and your password. Your password is
            stored in a scrambled form that nobody can read, including us.
          </li>
          <li>
            <strong>Your photo,</strong> if you choose to upload one.
          </li>
          <li>
            <strong>Your solutions:</strong> the code you submit, the language, when you sent it and the result.
          </li>
          <li>
            <strong>Your contest results:</strong> the contests you took part in and your scores.
          </li>
          <li>
            <strong>Basic connection details:</strong> your IP address and the pages you open, which we use to keep
            the site secure and to stop abuse.
          </li>
        </ul>

        <h2>Who can see it</h2>
        <ul>
          <li>Everyone can see your name and score on the standings of contests you join.</li>
          <li>Only you can see your code. Our administrators can open it to fix problems or check for cheating.</li>
          <li>Your email address is never shown to other users.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use a single cookie to keep you logged in. Without it you could not log in, so there is nothing to
          accept or refuse. We do not use advertising or tracking cookies, and no other company can see what you
          do on Ma’at.
        </p>
        <p>
          Your browser also remembers the code you are typing and your chosen language, so you do not lose your
          work if you close the page. This stays on your device and is never sent to us.
        </p>

        <h2>Emails</h2>
        <p>We only email you when you ask to reset your password.</p>

        <h2>How long we keep it</h2>
        <p>
          We keep your data for as long as you have an account. Connection details are deleted after a short time.
        </p>

        <h2>Deleting your account</h2>
        <p>
          You can delete your account from <Link to="/profile">your account page</Link>. We keep it for 30 days in
          case you change your mind: log in during that time and everything is back as it was. After 30 days we
          delete your account, your photo, your solutions and your contest results for good.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask us for a copy of your data, ask us to correct it, or ask us to delete it. You can change your
          name, photo and password yourself on your account page. For anything else, write to <Contact />. If you
          live in the European Economic Area or the United Kingdom, you can also complain to your local data
          protection authority.
        </p>

        <h2>Children</h2>
        <p>
          Ma’at is not meant for children under 13. If you believe a child has created an account, write to us and
          we will delete it.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change this policy, we will update the date at the top of this page. For important changes, we will
          also let you know on the site.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about your privacy? Write to <Contact />.
        </p>
      </article>
    </div>
  )
}
