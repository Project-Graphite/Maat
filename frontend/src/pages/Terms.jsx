import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { Contact } from './Privacy.jsx'

export default function Terms() {
  return (
    <div className="page">
      <Seo
        title="Terms of use"
        description="The rules for using Ma’at: your account, fair play in contests, and what you can expect from us."
        path="/terms"
      />
      <article className="legal">
        <h1>Terms of use</h1>
        <p className="muted">Last updated 27 October 2026</p>

        <p style={{ marginTop: 24 }}>
          Welcome to Ma’at. By creating an account or using the site, you agree to these terms. Please read them,
          they are short.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Use an email address you can reach, so you can reset your password if you forget it.</li>
          <li>Keep your password to yourself. You are responsible for what happens on your account.</li>
          <li>Have only one account.</li>
          <li>Choose a name that is not offensive and does not pretend to be someone else.</li>
        </ul>

        <h2>Playing fair</h2>
        <ul>
          <li>During a contest, solve the problems on your own. Do not share solutions or get help from others.</li>
          <li>Do not use more than one account in the same contest.</li>
          <li>Do not copy and publish the problems somewhere else without our permission.</li>
        </ul>

        <h2>Using the site safely</h2>
        <p>Submit code that tries to solve the problem. Please do not:</p>
        <ul>
          <li>submit code meant to harm the site, break out of the place where it runs, or reach other users’ data</li>
          <li>send automated traffic or try to get around the limits on how often you can submit</li>
          <li>try to slow the site down or take it offline</li>
        </ul>
        <p>If you break these rules, we may remove your submissions or close your account.</p>

        <h2>Your code</h2>
        <p>
          The code you write is yours. By submitting it, you allow us to store it, run it to judge it, and show it to
          you and our administrators. We will not publish it.
        </p>

        <h2>Results</h2>
        <p>
          Your result is decided by the problem’s tests and its time and memory limits. If we find a mistake in a
          problem, we may judge submissions again and correct results or contest standings.
        </p>

        <h2>Availability</h2>
        <p>
          We work to keep Ma’at running and accurate, but we cannot promise it will always be available or free of
          mistakes. Keep your own copy of code you care about.
        </p>

        <h2>Our responsibility</h2>
        <p>
          Ma’at is provided as it is. As far as the law allows, we are not responsible for losses caused by using
          the site or by not being able to use it. Nothing here takes away rights that the law gives you.
        </p>

        <h2>Leaving</h2>
        <p>
          You can stop using Ma’at at any time and delete your account from{' '}
          <Link to="/profile">your account page</Link>. We may suspend or close accounts that break these terms.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows when they last changed. If you keep using the site
          after a change, you accept the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Write to <Contact />. How we handle your data is explained in our{' '}
          <Link to="/privacy">privacy policy</Link>.
        </p>
      </article>
    </div>
  )
}
