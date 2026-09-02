<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/images/horizontal-white.png">
    <img src="assets/images/horizontal.png" alt="Plinto Logo" width="300"/>
  </picture>
  
  <p><strong>An open-source household finance manager designed to replace spreadsheets with a structured, long-term solution.</strong></p>
</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Why Plinto?](#-why-plinto)
- [What does Plinto do?](#-what-does-plinto-do)
- [Getting Started](#-getting-started)
- [Self-Hosting](#-self-hosting)
- [Contributing](#-contributing)
- [Code of Conduct](#-code-of-conduct)

---

## 📖 About

**Plinto** is an open-source application focused on managing family finances. This page centralizes the project documentation, covering its purpose, functionality, and technical foundations, and serves as a reference point for users and contributors.

---

## 🎯 Why Plinto?

**Plinto** was created to demonstrate technical skills through the development of a real, functional open-source application. It is a project actively used to manage family finances, built with a strong focus on:

- ✨ **Practicality** - Real-world solutions for real-world problems
- 🔍 **Clarity** - Intuitive design and transparent processes
- 🏗️ **Long-term maintainability** - Built to last and evolve

Beyond personal use, the goal is for **Plinto** to be useful to others facing similar financial organization challenges. In the future, this project may also serve as the foundation for a more mature product, informed by real-world usage and community feedback.

---

## 🚀 What does Plinto do?

Plinto aims to replace the traditional spreadsheets many households rely on to track income, expenses, and pending payments. Instead of maintaining fragmented and manual records, the project explores a more structured, flexible, and modern way to organize household finances.

### Key Features

> **Note:** These represent the intended direction of the project rather than a finalized feature set.

- 📊 **Financial Tracking** - Track income, expenses, and pending payments
- 📈 **Better Understanding** - Gain insights into your financial situation
- 💡 **Informed Decisions** - Build healthier financial habits
- 🎯 **Long-term Planning** - Improve how families relate to and plan their finances

Beyond basic financial tracking, Plinto is designed as a supportive tool that helps people better understand their financial situation, build healthier habits, and make more informed decisions. The long-term vision seeks to assist families in improving how they relate to and plan their finances.

---

## 🚧 Getting Started

> ⚠️ **Early Development Stage**
> 
> Plinto is still in its early days, so there is currently no setup or onboarding process available. At this stage, the project is focused on defining its direction, ideas, and foundations—before any code is ready to run without complaints.

This section will be updated as soon as Plinto becomes something you can actually install, configure, and use without guessing. Until then, consider this documentation a preview of what's coming, rather than a set of instructions you can follow today.

---

## 🏠 Self-Hosting

Plinto ships as Docker images with a self-host `docker-compose.yml` (nginx +
web + api + postgres, per [ADR 0005](docs/adr/0005-deployment-distribution-nginx.md)).
See **[docs/delivery/self-host.md](docs/delivery/self-host.md)** for the full
guide, including the OIDC provider setup and a gotcha around cookies on
plain HTTP.

---

## 🤝 Contributing

As an open-source project, **Plinto** welcomes contributions from the community. While the project is still in its early development stage and actively defining its foundations, ideas, feedback, and future contributions are appreciated.

If you're interested in contributing—whether through code, documentation, design, or suggestions—please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

---

## 📜 Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md) version 3.0. By participating in this project, you are expected to uphold this code. Please report unacceptable behavior to victorolave1131@gmail.com.

---

## 📝 License

Copyright (c) 2025 Victor Olave.

Plinto is free software, released under the **GNU Affero General Public License v3.0** (AGPL-3.0-only). You may run, study, modify and redistribute it, including as a hosted service, provided that anyone who interacts with a modified version over a network can obtain its complete source code under the same license. See the [LICENSE](LICENSE) file for the full text.

The name **Plinto** and its logo are trademarks of the author and are **not** covered by the license. Forks and hosted deployments must not present themselves as Plinto or use the logo without permission.
