/**
 * Every destination the landing links to, in one place.
 *
 * The approved design was a mockup: its buttons and links carried no
 * destination, because nobody clicks a mockup. They were ported as-is and
 * shipped as `href="#"`, which is faithful but dead. These are the real
 * targets, and each one is a path that exists in this repository.
 *
 * Keep them pointing at `main`: that is the branch a visitor should land on.
 */
const REPO = 'https://github.com/victorolave/plinto'
const BLOB = `${REPO}/blob/main`

export const LINKS = {
  /** The repository itself. */
  repo: REPO,

  /**
   * Where "Instalarlo gratis" / "Install it for free" goes: the operator's
   * guide, not the README. Someone clicking that button wants the steps.
   */
  selfHost: `${BLOB}/docs/delivery/self-host.md`,

  /** AGPL-3.0, the full text. */
  license: `${BLOB}/LICENSE`,

  /** How to contribute. */
  contributing: `${BLOB}/CONTRIBUTING.md`,

  /** The documentation folder. There is no docs site yet. */
  docs: `${REPO}/tree/main/docs`,

  /**
   * Cloud does not exist yet, so "Plinto Cloud" stays an in-page anchor to
   * the plans section, where it is marked as coming soon. It must not
   * promise a destination that is not there.
   */
  cloud: '#plans',
} as const
