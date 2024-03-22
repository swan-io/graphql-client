import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import Layout from "@theme/Layout";
import clsx from "clsx";
import React from "react";
import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className={styles.heroLeft}>
        <img
          src={"./img/logo.svg"}
          alt="GraphQL Client logo"
          className={styles.heroLogo}
        />
        <div>
          <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.heroButtons}>
            <Link
              className={clsx("button button--lg", styles.heroButton)}
              to="/getting-started"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

const Block = ({ children, reversed = false, title, description }) => {
  return (
    <div
      className={reversed ? styles.contentBlockReversed : styles.contentBlock}
    >
      <div className={styles.contentBlockSide}>{children}</div>
      <div className={styles.contentBlockSide}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const videoContainer = React.useRef(null);

  React.useEffect(() => {
    const element = videoContainer.current;
    if (element) {
      const intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const video = element.querySelector("video");
              if (video) {
                video.play();
              }
            }
          });
        },
        {
          rootMargin: "100px",
        },
      );
      intersectionObserver.observe(element);
      return () => intersectionObserver.unobserve(element);
    }
  }, []);

  return (
    <Layout
      title={`GraphQL Client: ${siteConfig.tagline}`}
      description="A simple, typesafe GraphQL client for React"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
