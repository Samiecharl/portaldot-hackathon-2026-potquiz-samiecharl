# 🧠 POT Quiz — Blockchain Trivia Game on Portaldot

A fully on-chain blockchain trivia game built on the **Portaldot Network** for Hackathon Season 1.

## 🎯 Problem Statement

Blockchain education is a major barrier to adoption. Most people don't understand what Layer 0, RWA, staking, or cross-chain bridges mean — and there's no fun, incentivised way to learn. At the same time, most blockchain apps don't give everyday users a reason to interact with the chain beyond speculation.

## ✅ Solution

POT Quiz turns blockchain education into a game. Players answer trivia questions about blockchain and Portaldot, earn real **POT tokens** for correct answers, and compete on a live leaderboard. Every score is permanently saved on the Portaldot blockchain.

## ⛓ How POT is Used as Gas

Every interaction with the blockchain uses POT as gas:
- **Score saving** — final score written on-chain via `system.remark`
- **Bonus claims** — qualifying scores recorded on-chain as proof
- **Bonus payouts** — admin sends real POT to winners via `balances.transferKeepAlive`

## 🏆 Features

- 🎮 Timed trivia quiz with customizable questions, timer and round length
- 🏆 On-chain leaderboard with player names, scores and POT earned
- 🎁 Bonus prize system — admin sets threshold and reward amount
- 💸 Admin sends bonus POT directly to winners' wallets
- 🔒 Password-protected admin panel
- 📤 Share score button generates ready-made social post
- 👋 Welcome screen with player name input
- ⚙️ Full admin panel — add/delete questions, set timer, set bonus rewards

## 🛠 Tech Stack

- **React** + **Vite** — frontend
- **@polkadot/api** — blockchain connection
- **@polkadot/extension-dapp** — wallet integration
- **Portaldot Node** — local Substrate-based blockchain (dev mode)
- **Netlify** — deployment

## 🚀 How to Run Locally

### Prerequisites
- Node.js v20+
- Portaldot node binary
- Polkadot.js browser extension

### 1. Start the Portaldot node
```bash
cd ~/portaldot-testnet-ubuntu
./portaldot_dev --dev --force-authoring --rpc-external --ws-external --rpc-cors all
```

### 2. Install dependencies and start the app
```bash
cd game
npm install
npm run dev -- --port 5174
```

### 3. Open in browser
http://localhost:5174
### 4. Connect wallet
Install the [Polkadot.js extension](https://polkadot.js.org/extension), create an account, and fund it from Alice on the local node at `http://localhost:9944`.

## 🎬 Demo Video
[Watch the demo](https://jam.dev/c/d3e28bd2-7779-4f1d-ae04-c2bdb482e56b)

## 👤 Team
- **Samiecharl** — Solo Builder, Nigeria

## 📄 License
MIT