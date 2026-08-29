import Link from "next/link";
import { ArrowRight, Layers3, Link2, ScanLine, Sparkles } from "lucide-react";
import { featuredWork, movementQuestions } from "./content";

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="FACEBACK.CAM home">
          FACEBACK<span>.CAM</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#work">Work</a>
          <a href="#questions">Questions</a>
          <a href="#stories">Stories</a>
        </nav>
        <Link className="mini-cta" href="/join">
          Join
        </Link>
      </header>

      <section className="hero section-pad">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="record-dot" /> Creators And Machines
          </p>
          <h1>
            Everything you make.
            <span>One page that doesn&apos;t erase you.</span>
          </h1>
          <p className="hero-lede">
            Bring your music, art, videos, writing, games and experiments
            together. Build a living home for your work—and join creators
            facing back at the anti-AI backlash.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/join">
              Become a founding creator <ArrowRight size={18} />
            </Link>
            <Link className="button button-quiet" href="/@callmedaddy">
              Explore a creator page
            </Link>
          </div>
        </div>

        <div className="hero-stage" aria-label="Example creator inventory">
          <div className="viewfinder-corner viewfinder-tl" />
          <div className="viewfinder-corner viewfinder-tr" />
          <div className="viewfinder-corner viewfinder-bl" />
          <div className="viewfinder-corner viewfinder-br" />
          <div className="stage-meta">
            <span>LIVE INVENTORY</span>
            <span>05 WORKS</span>
          </div>
          <div className="creator-chip">
            <div className="avatar avatar-wc">WC</div>
            <div>
              <strong>Call Me Daddy</strong>
              <span>MusicSubject · Founding creator</span>
            </div>
          </div>
          <div className="stage-stack">
            {featuredWork.slice(0, 3).map((work, index) => (
              <div className={`stage-card stage-card-${index + 1}`} key={work.title}>
                <span>{work.type}</span>
                <strong>{work.title}</strong>
                <small>{work.note}</small>
              </div>
            ))}
          </div>
          <Link className="stage-link" href="/@callmedaddy">
            Open full page <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="value-strip" aria-label="How FACEBACK works">
        <article>
          <Link2 size={22} />
          <div>
            <strong>Paste your links</strong>
            <span>Bring work in from anywhere.</span>
          </div>
        </article>
        <article>
          <Layers3 size={22} />
          <div>
            <strong>Build your inventory</strong>
            <span>Group versions, stories and projects.</span>
          </div>
        </article>
        <article>
          <ScanLine size={22} />
          <div>
            <strong>Share one home</strong>
            <span>One profile. Every medium.</span>
          </div>
        </article>
      </section>

      <section className="section-pad split-section" id="work">
        <div className="section-heading">
          <p className="eyebrow">Proof over permission</p>
          <h2>Your work is the argument.</h2>
          <p>
            A FACEBACK page is more than a stack of buttons. Connect the old
            work, the new work, the tools and the decisions that made it yours.
          </p>
          <Link className="text-link" href="/@callmedaddy">
            See the founding profile <ArrowRight size={17} />
          </Link>
        </div>
        <div className="work-grid">
          {featuredWork.map((work, index) => (
            <article className={`work-card work-tone-${(index % 3) + 1}`} key={work.title}>
              <div className="work-card-top">
                <span>{work.type}</span>
                <span>0{index + 1}</span>
              </div>
              <div>
                <h3>{work.title}</h3>
                <p>{work.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="questions-section section-pad" id="questions">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Questions worth answering</p>
          <h2>Make the logic survive the question.</h2>
          <p>
            FACEBACK is not asking anyone to pretend every use of AI is ethical.
            We are asking why using a new tool supposedly makes the creator vanish.
          </p>
        </div>
        <div className="question-list">
          {movementQuestions.map((question, index) => (
            <article key={question}>
              <span>Q{index + 1}</span>
              <p>{question}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stories-section section-pad" id="stories">
        <div className="story-copy">
          <p className="eyebrow">Faceback stories</p>
          <h2>What happened when creators challenged the claim?</h2>
          <p>
            Members can document what was said, what they asked, how the other
            person answered, and where the reasoning held—or fell apart.
          </p>
          <Link className="button button-dark" href="/join">
            Tell your story <ArrowRight size={18} />
          </Link>
        </div>
        <blockquote className="story-card">
          <Sparkles size={25} />
          <p>
            “AI lets me get ideas out of my head quickly—and revisit music I
            wrote long before AI was in the mix.”
          </p>
          <footer>
            <strong>William · Call Me Daddy</strong>
            <span>Founding creator</span>
          </footer>
        </blockquote>
      </section>

      <section className="join-section section-pad">
        <p className="eyebrow">Founding creator access</p>
        <h2>Don&apos;t defend an empty page. Show them what you make.</h2>
        <p>
          Claim your FACEBACK creator home, organize your work, and help build
          a community where creators using AI are allowed to count as creators.
        </p>
        <Link className="button button-light" href="/join">
          Build your FACEBACK page <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="footer">
        <div>
          <Link className="wordmark" href="/">
            FACEBACK<span>.CAM</span>
          </Link>
          <p>Creators And Machines, facing back at the anti-AI backlash.</p>
        </div>
        <span>Artists Against Artists Against Generative AI</span>
      </footer>
    </main>
  );
}
