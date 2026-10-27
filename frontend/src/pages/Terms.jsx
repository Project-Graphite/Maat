import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { Contact } from './Privacy.jsx'

export default function Terms() {
  return (
    <div className="page">
      <Seo
        title="Terms of use"
        description="The rules for using Ma’at: your account, acceptable use of the judge, contests, and what we promise in return."
        path="/terms"
      />
      <article className="legal">
        <h1>Terms of use</h1>
        <p className="muted">Last updated 24 October 2026</p>

        <p style={{ marginTop: 24 }}>
          By creating an account or using Ma’at you agree to these terms. If you do not agree, please do not
          use the site.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Give a real email address. You need it to reset your password.</li>
          <li>Keep your password to yourself. What happens on your account is your responsibility.</li>
          <li>One person, one account. In contests, extra accounts are treated as cheating.</li>
        </ul>

        <h2>What you may do</h2>
        <p>
          Use the site to practise programming, take part in contests, and read the problems. Problem
          statements and the judge’s tests belong to the site and its authors. Do not copy them out in bulk or
          republish them without permission.
        </p>

        <h2>What you may not do</h2>
        <ul>
          <li>
            Attack the judge. That includes trying to escape the sandbox, reach the network, read other
            people’s code or tests, or overload the machines. Programs run in a sealed container on purpose.
          </li>
          <li>Submit malware, or code written to harm the site or other users.</li>
          <li>Get around rate limits, or send automated traffic that is not an ordinary use of the site.</li>
          <li>
            Cheat in contests. Do not share solutions, receive help, or use several accounts while a contest
            is running.
          </li>
          <li>Impersonate someone, or choose a name that is abusive.</li>
        </ul>
        <p>Breaking these rules can lead to submissions being removed or the account being closed.</p>

        <h2>Your code</h2>
        <p>
          You keep the rights to the code you submit. You give the site permission to store it, run it, and show
          it to you and to administrators, which is what the service needs to work. We will not publish your
          code without asking.
        </p>

        <h2>Verdicts and contests</h2>
        <p>
          A verdict is the judge’s result against the problem’s tests, under that problem’s limits. The
          operator may correct a verdict or a contest result if a problem turns out to have a mistake, and may
          cancel a contest in rare cases. Contest rankings follow the rules shown on each contest page.
        </p>

        <h2>Availability</h2>
        <p>
          Ma’at is provided as it is. We try to keep it running and accurate, but we do not promise it will
          always be available or free of errors. Submissions can be lost if something goes wrong, so keep a
          copy of code you care about.
        </p>

        <h2>Liability</h2>
        <p>
          To the extent the law allows, the operator is not responsible for losses that come from using, or not
          being able to use, the site. Nothing in these terms limits rights you have by law that cannot be
          waived.
        </p>

        <h2>Ending your account</h2>
        <p>
          You can stop using the site at any time. To have your account deleted, write to <Contact />. We may
          suspend or close accounts that break these terms.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. The date at the top shows when they last changed. If you keep using the
          site after a change, you accept the new terms.
        </p>

        <h2>Your data</h2>
        <p>
          How we handle personal data is described in the <Link to="/privacy">privacy policy</Link>.
        </p>
      </article>
    </div>
  )
}
