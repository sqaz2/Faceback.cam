import Link from "next/link";
import { ArrowRight, Eye, Layers3, Link2, Radio, ScanLine, Sparkles } from "lucide-react";
import { featuredWork, movementQuestions } from "./content";
import { PublicRooms } from "./arena/public-rooms";

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="FACEBACK.CAM home">
          FACEBACK<span>.CAM</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/coke-music">Coke Music</Link>
          <Link href="/arena">Arena</Link>
          <Link href="/watch">Watch</Link>
          <a href="#work">Work</a>
          <a href="#questions">Questions</a>
          <a href="#stories">Stories</a>
        </nav>
        <Link className="mini-cta" href="/arena">
          Play
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
            together. Then meet other creators in fast live rounds where the
            work gets judged before the creator gets revealed.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/coke-music">
              Enter Coke Music <ArrowRight size={18} />
            </Link>
            <Link className="button button-primary" href="/arena">
              Create or join a live room <ArrowRight size={18} />
            </Link>
            <Link className="button button-quiet" href="/join">
              Build your creator page
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

      <section className="arena-home-section section-pad">
        <div>
          <p className="eyebrow"><Radio size={16} /> Live creative arena</p>
          <h2>Make fast. Vote blind. Then the winner schools the room.</h2>
          <p>
            Choose Rap Battle, Punchline, Hook Lab, Creative Pitch, Caption Clash
            or Flip It. Everyone gets the same constraint, the room judges the
            work before seeing the creator, and the winner breaks down the move
            so everyone leaves with something reusable.
          </p>
          <div className="arena-home-actions">
            <Link className="button button-dark" href="/arena">
              Create or join a room <ArrowRight size={18} />
            </Link>
            <Link className="arena-watch-link" href="/watch">
              <Eye size={17} /> Watch a live room
            </Link>
          </div>
        </div>
        <div className="arena-home-flow" aria-label="Arena round flow">
          <span>01 CHOOSE GAME</span>
          <span>02 CREATE</span>
          <span>03 BLIND VOTE</span>
          <span>04 WINNER TEACHES</span>
        </div>
      </section>

      <PublicRooms />

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
