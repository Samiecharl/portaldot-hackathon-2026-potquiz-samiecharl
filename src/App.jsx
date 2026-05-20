import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, push } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyAFaOqygoe6iVHWqgdfwk27BKRZ6YhSqKU",
  authDomain: "portaldotquiz.firebaseapp.com",
  databaseURL: "https://portaldotquiz-default-rtdb.firebaseio.com",
  projectId: "portaldotquiz",
  storageBucket: "portaldotquiz.firebasestorage.app",
  messagingSenderId: "530468848067",
  appId: "1:530468848067:web:c1e8a3e6f71c36099c7d76",
  measurementId: "G-SQ9KG9G140"
}
const firebaseApp = initializeApp(firebaseConfig)
const db = getDatabase(firebaseApp)

const DEFAULT_QUESTIONS = [
  { q: 'What is the native token of Portaldot?', options: ['DOT', 'ETH', 'POT', 'BNB'], answer: 2 },
  { q: 'What framework is Portaldot built on?', options: ['Ethereum VM', 'Cosmos SDK', 'Substrate', 'Avalanche'], answer: 2 },
  { q: 'What is a cross-chain bridge used for?', options: ['Mining tokens', 'Moving assets between blockchains', 'Creating NFTs', 'Voting'], answer: 1 },
  { q: 'What consensus mechanism does Portaldot use?', options: ['Proof of Work', 'Proof of Stake', 'Proof of Authority', 'Proof of History'], answer: 1 },
  { q: 'What does RWA stand for?', options: ['Random Wallet Address', 'Real World Asset', 'Relay Worker Algorithm', 'Rapid Web Access'], answer: 1 },
  { q: 'What does staking POT allow you to do?', options: ['Delete transactions', 'Earn rewards and vote', 'Mine Bitcoin', 'Create blockchains'], answer: 1 },
  { q: 'What is a block in a blockchain?', options: ['A game level', 'A bundle of confirmed transactions', 'A type of wallet', 'A validator node'], answer: 1 },
  { q: 'What does Layer 0 mean?', options: ['A chain with no fees', 'The foundation connecting chains', 'A gaming blockchain', 'A private blockchain'], answer: 1 },
]

const REWARD_PER_Q = 0.3
const POT_DECIMALS = 10_000_000_000n

function parseCountdown(str) {
  const match = str.match(/(\d+)h|(\d+)m|(\d+)s/g)
  if (!match) return 0
  let total = 0
  match.forEach(p => {
    const n = parseInt(p)
    if (p.includes('h')) total += n * 3600
    if (p.includes('m')) total += n * 60
    if (p.includes('s')) total += n
  })
  return total * 1000
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':')
}

export default function App() {
  const [api, setApi] = useState(null)
  const [block, setBlock] = useState(null)
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [phase, setPhase] = useState('home')
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS)
  const [activeQuestions, setActiveQuestions] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(15)
  const [results, setResults] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [onChainScores, setOnChainScores] = useState([])
  const [loadingLb, setLoadingLb] = useState(false)
  const [claims, setClaims] = useState([])
  const [error, setError] = useState('')
  const [sendingClaim, setSendingClaim] = useState(null)
  const [claimMsg, setClaimMsg] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [minScore, setMinScore] = useState(4)
  const [bonusPot, setBonusPot] = useState(2)
  const [questionsPerRound, setQuestionsPerRound] = useState(5)
  const [timePerQuestion, setTimePerQuestion] = useState(15)
  const [adminQ, setAdminQ] = useState('')
  const [adminOpts, setAdminOpts] = useState(['', '', '', ''])
  const [adminAnswer, setAdminAnswer] = useState(0)
  const [adminMsg, setAdminMsg] = useState('')
  const [adminPassword] = useState('portaldot2026')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [quizOpen, setQuizOpen] = useState(true)
  const [scheduleMode, setScheduleMode] = useState('manual')
  const [scheduledTime, setScheduledTime] = useState('')
  const [countdownInput, setCountdownInput] = useState('1h')
  const [quizStartsAt, setQuizStartsAt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    async function connect() {
      try {
        const wsEndpoint = import.meta.env.VITE_WS_ENDPOINT || 'ws://127.0.0.1:9944'
        const provider = new WsProvider(wsEndpoint)
        const _api = await ApiPromise.create({ provider })
        setApi(_api)
        _api.rpc.chain.subscribeNewHeads(h => setBlock(h.number.toNumber()))
      } catch {
        setError('Cannot reach Portaldot node. Make sure it is running.')
      }
    }
    connect()
  }, [])

  useEffect(() => {
    const settingsRef = ref(db, 'settings')
    const unsubSettings = onValue(settingsRef, (snap) => {
      const s = snap.val()
      if (!s) return
      setQuizOpen(s.quizOpen ?? true)
      setMinScore(s.minScore ?? 4)
      setBonusPot(s.bonusPot ?? 2)
      setQuestionsPerRound(s.questionsPerRound ?? 5)
      setTimePerQuestion(s.timePerQuestion ?? 15)
      setScheduleMode(s.scheduleMode ?? 'manual')
      setQuizStartsAt(s.quizStartsAt || null)
    })

    const questionsRef = ref(db, 'questions')
    const unsubQuestions = onValue(questionsRef, (snap) => {
      const q = snap.val()
      if (q) setQuestions(q)
    })

    const lbRef = ref(db, 'leaderboard')
    const unsubLb = onValue(lbRef, (snap) => {
      const data = snap.val()
      if (!data) { setLeaderboard([]); return }
      const arr = Object.values(data)
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }))
      setLeaderboard(arr)
    })

    const claimsRef = ref(db, 'claims')
    const unsubClaims = onValue(claimsRef, (snap) => {
      const data = snap.val()
      if (!data) { setClaims([]); return }
      setClaims(Object.entries(data).map(([id, v]) => ({ ...v, firebaseId: id })))
    })

    return () => { unsubSettings(); unsubQuestions(); unsubLb(); unsubClaims() }
  }, [])

  useEffect(() => {
    if (!quizStartsAt) return
    const interval = setInterval(() => {
      const left = quizStartsAt - Date.now()
      if (left <= 0) {
        setTimeLeft(0)
        clearInterval(interval)
        set(ref(db, 'settings/quizOpen'), true)
        set(ref(db, 'settings/quizStartsAt'), null)
        if (account && api) setPhase('welcome')
      } else {
        setTimeLeft(left)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [quizStartsAt, account, api])

  const refreshBalance = useCallback(async (addr) => {
    if (!api || !addr) return
    const { data } = await api.query.system.account(addr)
    setBalance(data.free.toBigInt())
  }, [api])

  useEffect(() => {
    if (account) refreshBalance(account.address)
  }, [account, refreshBalance])

  async function loadOnChainLeaderboard() {
    if (!api) return
    setLoadingLb(true)
    try {
      const currentBlock = await api.rpc.chain.getHeader()
      const current = currentBlock.number.toNumber()
      const from = Math.max(1, current - 500)
      const scores = []
      for (let b = from; b <= current; b += 10) {
        try {
          const hash = await api.rpc.chain.getBlockHash(b)
          const { block: blk } = await api.rpc.chain.getBlock(hash)
          for (const ex of blk.extrinsics) {
            const str = ex.toString()
            if (str.includes('POTQUIZ:')) {
              const match = str.match(/POTQUIZ:([^:]+):(\d+)\/(\d+):BLOCK(\d+)/)
              if (match) {
                scores.push({
                  name: match[1], score: parseInt(match[2]),
                  total: parseInt(match[3]), block: parseInt(match[4]),
                  pct: Math.round((parseInt(match[2]) / parseInt(match[3])) * 100)
                })
              }
            }
          }
        } catch {}
      }
      setOnChainScores(scores.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 })))
    } catch (e) { console.error(e) }
    setLoadingLb(false)
  }

  async function connectWallet() {
    setError('')
    const exts = await web3Enable('POT Quiz')
    if (!exts.length) { setError('Install the Polkadot.js extension first.'); return }
    const all = await web3Accounts()
    if (!all.length) { setError('No accounts found.'); return }
    setAccount(all[0])
  }

  function goToWelcome() {
    if (!account || !api) { setError('Connect your wallet first.'); return }
    if (!quizOpen) { setError('Quiz is not open yet. Check the countdown!'); return }
    setError('')
    setPhase('welcome')
  }

  function startGame() {
    if (!nameInput.trim()) { setError('Please enter your name first.'); return }
    setPlayerName(nameInput.trim())
    setError('')
    const max = Math.min(questionsPerRound, questions.length)
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, max)
    setActiveQuestions(shuffled)
    setPhase('quiz')
    setQIndex(0)
    setScore(0)
    setResults([])
    setTimer(timePerQuestion)
    setSelected(null)
    setAnswered(false)
  }

  useEffect(() => {
    if (phase !== 'quiz' || answered) return
    if (timer <= 0) { handleAnswer(null); return }
    const t = setTimeout(() => setTimer(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timer, answered])

  async function handleAnswer(idx) {
    if (answered) return
    setAnswered(true)
    setSelected(idx)
    const correct = idx === activeQuestions[qIndex].answer
    const newScore = correct ? score + 1 : score
    if (correct) setScore(newScore)
    setResults(r => [...r, { q: activeQuestions[qIndex].q, correct, chosen: idx, answer: activeQuestions[qIndex].answer }])

    setTimeout(async () => {
      if (qIndex + 1 >= activeQuestions.length) {
        if (api && account) {
          try {
            const injector = await web3FromAddress(account.address)
            const remark = `POTQUIZ:${nameInput.trim()}:${newScore}/${activeQuestions.length}:BLOCK${block}`
            api.tx.system.remark(remark).signAndSend(account.address, { signer: injector.signer }).catch(() => {})
          } catch {}
        }
        const entry = {
          address: account?.address || 'Unknown',
          short: nameInput.trim() || (account ? `${account.address.slice(0,6)}…${account.address.slice(-4)}` : 'Unknown'),
          score: newScore, total: activeQuestions.length,
          pot: (newScore * REWARD_PER_Q).toFixed(1),
          bonus: newScore >= minScore ? bonusPot : 0,
          block: block || 0, date: new Date().toLocaleDateString(), timestamp: Date.now()
        }
        await push(ref(db, 'leaderboard'), entry)
        if (newScore >= minScore && account) {
          await push(ref(db, 'claims'), {
            address: account.address,
            short: nameInput.trim() || `${account.address.slice(0,6)}…${account.address.slice(-4)}`,
            score: newScore, total: activeQuestions.length, bonus: bonusPot,
            block: block || 0, date: new Date().toLocaleDateString(), status: 'pending', timestamp: Date.now()
          })
        }
        await refreshBalance(account?.address)
        setPhase('result')
      } else {
        setQIndex(i => i + 1)
        setSelected(null)
        setAnswered(false)
        setTimer(timePerQuestion)
      }
    }, 1500)
  }

  async function sendBonus(claim) {
    if (!account || !api) { setClaimMsg('Connect your wallet first.'); return }
    setSendingClaim(claim.firebaseId)
    setClaimMsg('')
    try {
      const injector = await web3FromAddress(account.address)
      const amount = BigInt(claim.bonus) * POT_DECIMALS
      await new Promise((resolve, reject) => {
        api.tx.balances.transferKeepAlive(claim.address, amount)
          .signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              reject(new Error(dispatchError.toString()))
            } else if (status.isInBlock) {
              resolve()
            } else if (status.isDropped || status.isInvalid || status.isUsurped) {
              reject(new Error('Transaction failed: ' + status.type))
            }
          })
      })
      await set(ref(db, `claims/${claim.firebaseId}/status`), 'paid')
      setClaimMsg(`✅ Sent ${claim.bonus} POT to ${claim.short}!`)
    } catch (e) { setClaimMsg('❌ Transfer failed: ' + e.message) }
    setSendingClaim(null)
  }

  function shareScore() {
    const text = `🧠 ${playerName} just scored ${score}/${activeQuestions.length} on the Portaldot Trivia Quiz!\n\n⛓ Score saved on Portaldot blockchain · Block #${block}\n💰 Earned ${(score * REWARD_PER_Q).toFixed(1)} POT${score >= minScore ? ` + ${bonusPot} POT bonus! 🎁` : ''}\n\nPlay at https://portaldotquiz.netlify.app`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  async function saveSettings() {
    await set(ref(db, 'settings'), { quizOpen, minScore, bonusPot, questionsPerRound, timePerQuestion, scheduleMode, quizStartsAt: quizStartsAt || null })
    setAdminMsg(`✅ Saved! ${questionsPerRound} questions, ${timePerQuestion}s timer. Score ${minScore}+ earns ${bonusPot} bonus POT.`)
  }

  async function applySchedule() {
    if (scheduleMode === 'manual') {
      await set(ref(db, 'settings'), { quizOpen: true, minScore, bonusPot, questionsPerRound, timePerQuestion, scheduleMode, quizStartsAt: null })
      setAdminMsg('✅ Quiz is now OPEN — players can join!')
    } else if (scheduleMode === 'datetime') {
      if (!scheduledTime) { setAdminMsg('❌ Pick a date and time first.'); return }
      const target = new Date(scheduledTime).getTime()
      if (target <= Date.now()) { setAdminMsg('❌ That time is in the past!'); return }
      await set(ref(db, 'settings'), { quizOpen: false, minScore, bonusPot, questionsPerRound, timePerQuestion, scheduleMode, quizStartsAt: target })
      await set(ref(db, 'leaderboard'), null)
      setAdminMsg(`✅ Quiz scheduled for ${new Date(scheduledTime).toLocaleString()}`)
    } else if (scheduleMode === 'countdown') {
      const ms = parseCountdown(countdownInput)
      if (!ms) { setAdminMsg('❌ Invalid format. Use like: 1h, 30m, 90s'); return }
      const target = Date.now() + ms
      await set(ref(db, 'settings'), { quizOpen: false, minScore, bonusPot, questionsPerRound, timePerQuestion, scheduleMode, quizStartsAt: target })
      await set(ref(db, 'leaderboard'), null)
      setAdminMsg(`✅ Quiz starts in ${countdownInput}!`)
    }
  }

  async function closeQuiz() {
    await set(ref(db, 'settings'), { quizOpen: false, minScore, bonusPot, questionsPerRound, timePerQuestion, scheduleMode, quizStartsAt: null })
    setAdminMsg('🔴 Quiz is now CLOSED.')
  }

  async function addQuestion() {
    if (!adminQ.trim()) { setAdminMsg('Enter a question.'); return }
    if (adminOpts.some(o => !o.trim())) { setAdminMsg('Fill in all 4 options.'); return }
    const updated = [...questions, { q: adminQ, options: adminOpts, answer: adminAnswer }]
    await set(ref(db, 'questions'), updated)
    setAdminQ(''); setAdminOpts(['', '', '', '']); setAdminAnswer(0)
    setAdminMsg(`✅ Question added! You now have ${updated.length} questions.`)
  }

  async function deleteQuestion(i) {
    await set(ref(db, 'questions'), questions.filter((_, idx) => idx !== i))
  }

  async function resetQuestions() {
    await set(ref(db, 'questions'), DEFAULT_QUESTIONS)
    setAdminMsg('✅ Reset to default questions.')
  }

  async function clearLeaderboard() {
    await set(ref(db, 'leaderboard'), null)
    setOnChainScores([])
  }

  function playAgain() {
    setPhase('home'); setScore(0); setResults([]); setSelected(null)
    setAnswered(false); setTimer(timePerQuestion); setQIndex(0)
    setNameInput(''); setError(''); setCopied(false)
  }

  const timerPct = (timer / timePerQuestion) * 100
  const timerColor = timer > 8 ? '#22c55e' : timer > 4 ? '#f59e0b' : '#ef4444'
  const fmt = (v) => v ? (Number(v) / 1e10).toFixed(2) : '0.00'
  const pendingClaims = claims.filter(c => c.status === 'pending')
  const displayLb = onChainScores.length > 0 ? onChainScores : leaderboard

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logo.png" alt="Portaldot" style={{width:36,height:36,borderRadius:'50%'}}/>
          <div>
            <div style={S.logo}>Portaldot Trivia Quiz</div>
            <div style={S.sub}>Blockchain Trivia on Portaldot</div>
          </div>
        </div>
        <div style={S.headerRight}>
          {block && <div style={S.blockBadge}>⛓ Block #{block}</div>}
          {!quizOpen && quizStartsAt && (
            <div style={{...S.blockBadge, color:'#f59e0b', borderColor:'#854d0e'}}>⏳ {formatCountdown(timeLeft)}</div>
          )}
          <button style={S.navBtn} onClick={() => { setPhase('leaderboard'); loadOnChainLeaderboard() }}>🏆 Leaderboard</button>
          <button style={S.navBtn} onClick={() => setPhase('admin')}>
            ⚙️ Admin {pendingClaims.length > 0 && <span style={S.badge}>{pendingClaims.length}</span>}
          </button>
          {!account
            ? <button style={S.connectBtn} onClick={connectWallet}>Connect Wallet</button>
            : <div style={S.accountBadge}>
                <div>{account.address.slice(0,6)}…{account.address.slice(-4)}</div>
                {balance !== null && <div style={S.balSmall}>{fmt(balance)} POT</div>}
              </div>
          }
        </div>
      </div>

      {error && <div style={S.errorBox}>⚠️ {error}</div>}

      {phase === 'home' && (
        <div style={S.center}>
          <div style={S.homeCard}>
            <img src="/logo.png" alt="Portaldot" style={{width:80,height:80,borderRadius:'50%',marginBottom:'0.75rem'}}/>
            <div style={S.homeTitle}>Portaldot Trivia Quiz</div>
            <div style={S.homeDesc}>
              Test your blockchain knowledge. Score <strong style={{color:'#c084fc'}}>{minScore}/{questionsPerRound}+</strong> to win a <strong style={{color:'#c084fc'}}>{bonusPot} POT bonus!</strong>
            </div>
            {!quizOpen && quizStartsAt && (
              <div style={S.countdownBanner}>
                <div style={{fontSize:32,marginBottom:4}}>⏳</div>
                <div style={{fontWeight:700,fontSize:'1.1rem',color:'#f59e0b'}}>Quiz starts in</div>
                <div style={{fontSize:'2.5rem',fontWeight:700,color:'#f59e0b',fontVariantNumeric:'tabular-nums',letterSpacing:2}}>{formatCountdown(timeLeft)}</div>
                <div style={{fontSize:12,color:'#8b949e',marginTop:4}}>Get ready — connect your wallet now!</div>
              </div>
            )}
            {!quizOpen && !quizStartsAt && (
              <div style={{...S.countdownBanner, borderColor:'#991b1b'}}>
                <div style={{fontSize:24}}>🔴</div>
                <div style={{fontWeight:700,color:'#f87171'}}>Quiz is currently closed</div>
                <div style={{fontSize:12,color:'#8b949e',marginTop:4}}>Check back later or follow the admin for updates</div>
              </div>
            )}
            <div style={S.rulesGrid}>
              <div style={S.ruleBox}><div style={S.ruleVal}>{questionsPerRound}</div><div style={S.ruleLbl}>Questions</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{REWARD_PER_Q} POT</div><div style={S.ruleLbl}>Per correct</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{minScore}+</div><div style={S.ruleLbl}>Bonus threshold</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{bonusPot} POT</div><div style={S.ruleLbl}>Bonus prize</div></div>
            </div>
            {!account
              ? <button style={S.bigBtn} onClick={connectWallet}>Connect Wallet to Play</button>
              : quizOpen
                ? <button style={S.bigBtn} onClick={goToWelcome}>Start Quiz →</button>
                : <button style={{...S.bigBtn, background:'#1e1333', color:'#6b7280', cursor:'not-allowed'}} disabled>
                    {quizStartsAt ? `Opens in ${formatCountdown(timeLeft)}` : 'Quiz Closed'}
                  </button>
            }
            {leaderboard.length > 0 && (
              <div style={S.miniLb}>
                <div style={S.miniLbTitle}>🏆 Current Quiz — Top Players</div>
                {leaderboard.slice(0, 3).map((e, i) => (
                  <div key={i} style={S.miniLbRow}>
                    <span>{['🥇','🥈','🥉'][i]}</span>
                    <span style={{flex:1,color:'#8b949e',fontSize:13}}>{e.short}</span>
                    <span style={{color:'#c084fc',fontWeight:700}}>{e.score}/{e.total||5}</span>
                    {e.bonus > 0 && <span style={{color:'#a78bfa',fontSize:12}}>+{e.bonus} POT 🎁</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'welcome' && (
        <div style={S.center}>
          <div style={S.homeCard}>
            <div style={{fontSize:48,marginBottom:'0.75rem'}}>👋</div>
            <div style={S.homeTitle}>What's your name?</div>
            <div style={S.homeDesc}>Your name will appear on the leaderboard for everyone to see.</div>
            {error && <div style={{...S.errorBox,margin:'0 0 1rem'}}>{error}</div>}
            <input style={{...S.input,fontSize:'1.1rem',textAlign:'center',marginBottom:'1rem'}}
              placeholder="Enter your name..." value={nameInput} maxLength={20}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startGame()} autoFocus/>
            <div style={{fontSize:12,color:'#8b949e',marginBottom:'1rem'}}>
              Playing as: <strong style={{color:'#c084fc'}}>{account?.address.slice(0,6)}…{account?.address.slice(-4)}</strong>
            </div>
            <button style={S.bigBtn} onClick={startGame}>Let's Play! 🚀</button>
            <button style={{...S.bigBtn,background:'#1e1333',color:'#e6edf3',marginTop:'0.5rem'}}
              onClick={() => { setPhase('home'); setError('') }}>← Back</button>
          </div>
        </div>
      )}

      {phase === 'quiz' && activeQuestions.length > 0 && (
        <div style={S.center}>
          <div style={S.quizCard}>
            <div style={S.progressRow}>
              <span style={{fontSize:'0.8rem',color:'#8b949e'}}>
                {playerName && <span style={{color:'#c084fc',fontWeight:600}}>{playerName} · </span>}
                Question {qIndex+1} of {activeQuestions.length}
              </span>
              <span style={{fontSize:'0.8rem',color:'#c084fc',fontWeight:600}}>Score: {score}</span>
            </div>
            <div style={S.progressTrack}><div style={{...S.progressFill,width:`${(qIndex/activeQuestions.length)*100}%`}}/></div>
            <div style={S.timerRow}>
              <div style={S.timerTrack}><div style={{...S.timerFill,width:`${timerPct}%`,background:timerColor}}/></div>
              <span style={{fontSize:'0.85rem',fontWeight:700,color:timerColor,minWidth:28}}>{timer}s</span>
            </div>
            <div style={S.questionText}>{activeQuestions[qIndex].q}</div>
            <div style={S.optionsGrid}>
              {activeQuestions[qIndex].options.map((opt, i) => {
                let style = S.optBtn
                if (answered) {
                  if (i === activeQuestions[qIndex].answer) style = {...S.optBtn,...S.optCorrect}
                  else if (i === selected) style = {...S.optBtn,...S.optWrong}
                  else style = {...S.optBtn,opacity:0.4}
                }
                return (
                  <button key={i} style={style} onClick={() => handleAnswer(i)} disabled={answered}>
                    <span style={S.optLetter}>{['A','B','C','D'][i]}</span>
                    <span>{opt}</span>
                    {answered && i === activeQuestions[qIndex].answer && <span style={{marginLeft:'auto'}}>✓</span>}
                    {answered && i === selected && i !== activeQuestions[qIndex].answer && <span style={{marginLeft:'auto'}}>✗</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div style={S.center}>
          <div style={S.homeCard}>
            <div style={{fontSize:52,marginBottom:'.5rem'}}>
              {score === activeQuestions.length ? '🏆' : score >= minScore ? '🎉' : '😅'}
            </div>
            <div style={S.homeTitle}>
              {score === activeQuestions.length ? 'Perfect Score!' : score >= minScore ? 'Well Done!' : 'Better luck next time!'}
            </div>
            <div style={S.scoreDisplay}>{score} / {activeQuestions.length}</div>
            <div style={S.potEarned}>
              POT earned: <strong>{(score * REWARD_PER_Q).toFixed(1)} POT</strong>
              {balance !== null && <span style={{color:'#8b949e'}}> · Balance: {fmt(balance)} POT</span>}
            </div>
            {score >= minScore && (
              <div style={S.bonusBanner}>
                <div style={{fontSize:24,marginBottom:4}}>🎁</div>
                <div style={{fontWeight:700,fontSize:'1.1rem',color:'#a78bfa'}}>Bonus Unlocked!</div>
                <div style={{fontSize:'0.85rem',marginTop:4}}>You scored {score}/{activeQuestions.length} — you qualify for the <strong>{bonusPot} POT bonus!</strong></div>
                <div style={{fontSize:'0.75rem',color:'#8b949e',marginTop:6}}>Your claim is recorded. The admin will send your bonus POT shortly.</div>
              </div>
            )}
            {score < minScore && (
              <div style={S.missedBonus}>Score {minScore}/{activeQuestions.length}+ to unlock the {bonusPot} POT bonus next time!</div>
            )}
            <div style={S.chainProof}>✅ Score saved on Portaldot blockchain · Block #{block}</div>
            <div style={{width:'100%',marginTop:'1.25rem'}}>
              {results.map((r, i) => (
                <div key={i} style={{...S.reviewRow,borderColor:r.correct?'#22c55e33':'#ef444433'}}>
                  <span style={{fontSize:14,marginRight:8}}>{r.correct?'✅':'❌'}</span>
                  <span style={{fontSize:13,color:'#8b949e',flex:1,textAlign:'left'}}>{r.q}</span>
                </div>
              ))}
            </div>
            <button style={{...S.bigBtn,marginTop:'1.25rem',background:copied?'#22c55e':'#1d4ed8',color:'#fff'}} onClick={shareScore}>
              {copied ? '✅ Copied to clipboard!' : '📤 Share my score'}
            </button>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'0.5rem',width:'100%'}}>
              <button style={{...S.bigBtn,flex:1}} onClick={playAgain}>Play Again</button>
              <button style={{...S.bigBtn,flex:1,background:'#1e1333',color:'#e6edf3'}} onClick={() => { setPhase('leaderboard'); loadOnChainLeaderboard() }}>🏆 Leaderboard</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'leaderboard' && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:780,textAlign:'left'}}>
            <div style={{...S.homeTitle,textAlign:'center'}}>🏆 Leaderboard</div>
            <div style={{...S.homeDesc,textAlign:'center',marginBottom:'0.5rem'}}>Live scores from all players • synced in real-time</div>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:'1rem'}}>
              <button style={{...S.navBtn,fontSize:12}} onClick={loadOnChainLeaderboard} disabled={loadingLb}>
                {loadingLb ? '⏳ Scanning blockchain...' : '🔄 Refresh from chain'}
              </button>
            </div>
            {loadingLb && <div style={{textAlign:'center',padding:'2rem',color:'#a78bfa'}}>⛓ Scanning Portaldot blocks for scores...</div>}
            {!loadingLb && displayLb.length === 0 && <div style={{color:'#8b949e',padding:'2rem',textAlign:'center'}}>No scores found yet — play the quiz first!</div>}
            {!loadingLb && displayLb.length > 0 && (
              <table style={S.table}>
                <thead>
                  <tr>{['Rank','Player','Score','%','POT Earned','Bonus','Block'].map(h=>(<th key={h} style={S.th}>{h}</th>))}</tr>
                </thead>
                <tbody>
                  {displayLb.map((e,i)=>(
                    <tr key={i} style={i===0?S.trGold:i===1?S.trSilver:i===2?S.trBronze:S.tr}>
                      <td style={S.td}>{e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':`#${e.rank}`}</td>
                      <td style={S.td}>{e.name||e.short}</td>
                      <td style={{...S.td,fontWeight:700,color:'#c084fc'}}>{e.score}/{e.total||5}</td>
                      <td style={{...S.td,color:'#a78bfa'}}>{e.pct||Math.round((e.score/(e.total||5))*100)}%</td>
                      <td style={{...S.td,color:'#22c55e'}}>{e.pot||(e.score*REWARD_PER_Q).toFixed(1)} POT</td>
                      <td style={{...S.td,color:'#a78bfa'}}>{e.bonus>0?`+${e.bonus} POT 🎁`:'—'}</td>
                      <td style={{...S.td,color:'#8b949e'}}>#{e.block}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.25rem'}}>
              <button style={{...S.bigBtn,flex:1}} onClick={()=>setPhase('home')}>← Back</button>
              {displayLb.length>0&&<button style={{...S.bigBtn,flex:1,background:'#2d1b1b',color:'#f85149'}} onClick={clearLeaderboard}>Clear</button>}
            </div>
          </div>
        </div>
      )}

      {phase === 'admin' && !adminUnlocked && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:380}}>
            <div style={{fontSize:48,marginBottom:'0.75rem'}}>🔒</div>
            <div style={S.homeTitle}>Admin Access</div>
            <div style={S.homeDesc}>Enter the admin password to continue</div>
            <input type="password" style={{...S.input,textAlign:'center',fontSize:'1rem',marginBottom:'0.75rem'}}
              placeholder="Enter password" value={enteredPassword}
              onChange={e=>setEnteredPassword(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter'){
                  if(enteredPassword===adminPassword){setAdminUnlocked(true);setEnteredPassword('')}
                  else setAdminMsg('❌ Wrong password.')
                }
              }}/>
            {adminMsg&&<div style={{color:'#f85149',fontSize:13,marginBottom:'0.75rem'}}>{adminMsg}</div>}
            <button style={S.bigBtn} onClick={()=>{
              if(enteredPassword===adminPassword){setAdminUnlocked(true);setEnteredPassword('')}
              else setAdminMsg('❌ Wrong password.')
            }}>Unlock Admin</button>
            <button style={{...S.bigBtn,background:'#1e1333',color:'#e6edf3',marginTop:'0.5rem'}}
              onClick={()=>{setPhase('home');setEnteredPassword('');setAdminMsg('')}}>← Back</button>
          </div>
        </div>
      )}

      {phase === 'admin' && adminUnlocked && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:700,textAlign:'left'}}>
            <div style={{...S.homeTitle,textAlign:'center'}}>⚙️ Admin Panel</div>
            {adminMsg&&<div style={{...S.successBox,marginBottom:'1rem'}}>{adminMsg}</div>}
            {claimMsg&&<div style={{...S.successBox,marginBottom:'1rem'}}>{claimMsg}</div>}

            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>⏰ Quiz Schedule</div>
              <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
                {['manual','datetime','countdown'].map(m=>(
                  <button key={m} style={{...S.scorePickBtn,...(scheduleMode===m?S.scorePickActive:{})}} onClick={()=>setScheduleMode(m)}>
                    {m==='manual'?'🟢 Manual':m==='datetime'?'📅 Date & Time':'⏳ Countdown'}
                  </button>
                ))}
              </div>
              {scheduleMode==='manual'&&(
                <div style={{fontSize:13,color:'#a78bfa',marginBottom:'0.75rem'}}>
                  Current status: <strong style={{color:quizOpen?'#22c55e':'#f85149'}}>{quizOpen?'🟢 OPEN':'🔴 CLOSED'}</strong>
                </div>
              )}
              {scheduleMode==='datetime'&&(
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={S.formLabel}>Pick exact date and time</div>
                  <input type="datetime-local" style={{...S.input,marginBottom:0}} value={scheduledTime} onChange={e=>setScheduledTime(e.target.value)}/>
                </div>
              )}
              {scheduleMode==='countdown'&&(
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={S.formLabel}>Set countdown (e.g. 1h, 30m, 90s, 2h30m)</div>
                  <input style={{...S.input,marginBottom:0}} placeholder="e.g. 1h30m" value={countdownInput} onChange={e=>setCountdownInput(e.target.value)}/>
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button style={{...S.bigBtn,flex:1}} onClick={applySchedule}>
                  {scheduleMode==='manual'?'🟢 Open Quiz':'🚀 Schedule Quiz'}
                </button>
                {quizOpen&&<button style={{...S.bigBtn,flex:1,background:'#2d1b1b',color:'#f85149'}} onClick={closeQuiz}>🔴 Close Quiz</button>}
              </div>
              {quizStartsAt&&!quizOpen&&(
                <div style={{marginTop:'0.75rem',fontSize:13,color:'#f59e0b',textAlign:'center'}}>
                  ⏳ Quiz opens in <strong>{formatCountdown(timeLeft)}</strong>
                </div>
              )}
            </div>

            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>🎮 Game Settings</div>
              <div style={S.formLabel}>Seconds per question</div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'0.75rem'}}>
                <input type="number" min={5} max={50} value={timePerQuestion}
                  onChange={e=>setTimePerQuestion(Number(e.target.value))}
                  style={{...S.input,width:80,marginBottom:0,textAlign:'center'}}/>
                <span style={{fontSize:13,color:'#a78bfa'}}>seconds</span>
              </div>
              <div style={S.formLabel}>Questions per round</div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'0.75rem'}}>
                <input type="number" min={1} max={50} value={questionsPerRound}
                  onChange={e=>setQuestionsPerRound(Number(e.target.value))}
                  style={{...S.input,width:80,marginBottom:0,textAlign:'center'}}/>
                <span style={{fontSize:13,color:'#a78bfa'}}>you have {questions.length} questions in pool</span>
              </div>
              <div style={S.formLabel}>Minimum score for bonus</div>
              <div style={{display:'flex',gap:8,marginBottom:'0.75rem'}}>
                {[3,4,5].map(n=>(<button key={n} style={{...S.scorePickBtn,...(minScore===n?S.scorePickActive:{})}} onClick={()=>setMinScore(n)}>{n}+</button>))}
              </div>
              <div style={S.formLabel}>Bonus POT amount</div>
              <div style={{display:'flex',gap:8,marginBottom:'0.75rem'}}>
                {[1,2,3,5,10].map(n=>(<button key={n} style={{...S.scorePickBtn,...(bonusPot===n?S.scorePickActive:{})}} onClick={()=>setBonusPot(n)}>{n} POT</button>))}
              </div>
              <button style={S.bigBtn} onClick={saveSettings}>Save Settings</button>
            </div>

            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>
                💸 Pending Bonus Claims
                {pendingClaims.length>0&&<span style={S.badge}>{pendingClaims.length} pending</span>}
              </div>
              {pendingClaims.length===0
                ?<div style={{color:'#8b949e',fontSize:13,padding:'0.75rem 0'}}>No pending claims yet.</div>
                :pendingClaims.map(c=>(
                  <div key={c.firebaseId} style={S.claimRow}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#e6edf3'}}>{c.short}</div>
                      <div style={{fontSize:11,color:'#8b949e'}}>Score: {c.score}/{c.total||5} · Block #{c.block} · {c.date}</div>
                    </div>
                    <div style={{color:'#a78bfa',fontWeight:700,fontSize:14,marginRight:12}}>{c.bonus} POT</div>
                    <button style={{...S.sendBtn,opacity:sendingClaim===c.firebaseId?0.5:1}}
                      onClick={()=>sendBonus(c)} disabled={sendingClaim===c.firebaseId}>
                      {sendingClaim===c.firebaseId?'Sending…':'Send POT →'}
                    </button>
                  </div>
                ))
              }
              {claims.filter(c=>c.status==='paid').length>0&&(
                <div style={{marginTop:'0.75rem'}}>
                  <div style={{fontSize:12,color:'#8b949e',marginBottom:'0.4rem'}}>✅ Paid</div>
                  {claims.filter(c=>c.status==='paid').map(c=>(
                    <div key={c.firebaseId} style={{...S.claimRow,opacity:0.5}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:'#e6edf3'}}>{c.short}</div>
                        <div style={{fontSize:11,color:'#8b949e'}}>{c.date}</div>
                      </div>
                      <div style={{color:'#22c55e',fontSize:13}}>✅ {c.bonus} POT sent</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>✏️ Add Question</div>
              <div style={S.formLabel}>Question</div>
              <input style={S.input} placeholder="Type your question here..." value={adminQ} onChange={e=>setAdminQ(e.target.value)}/>
              <div style={S.formLabel}>Answer Options (select the correct one)</div>
              {adminOpts.map((opt,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <input type="radio" name="correct" checked={adminAnswer===i} onChange={()=>setAdminAnswer(i)} style={{accentColor:'#7c3aed'}}/>
                  <input style={{...S.input,marginBottom:0,flex:1}} placeholder={`Option ${['A','B','C','D'][i]}`} value={opt}
                    onChange={e=>{const u=[...adminOpts];u[i]=e.target.value;setAdminOpts(u)}}/>
                  {adminAnswer===i&&<span style={{color:'#22c55e',fontSize:11}}>✓</span>}
                </div>
              ))}
              <button style={{...S.bigBtn,marginTop:'0.5rem'}} onClick={addQuestion}>Add Question</button>
            </div>

            <div style={S.sectionBox}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                <div style={S.sectionTitle}>📋 Questions ({questions.length})</div>
                <button style={{...S.navBtn,fontSize:11}} onClick={resetQuestions}>Reset to defaults</button>
              </div>
              {questions.map((q,i)=>(
                <div key={i} style={S.qRow}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'#e6edf3',marginBottom:3}}>{i+1}. {q.q}</div>
                    <div style={{fontSize:11,color:'#22c55e'}}>✓ {q.options[q.answer]}</div>
                  </div>
                  <button style={S.deleteBtn} onClick={()=>deleteQuestion(i)}>✕</button>
                </div>
              ))}
            </div>

            <button style={{...S.bigBtn,background:'#1e1333',color:'#e6edf3'}}
              onClick={()=>{setPhase('home');setAdminUnlocked(false)}}>← Back to Game</button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page:{minHeight:'100vh',background:'#0d0a14',color:'#e6edf3',fontFamily:'system-ui,sans-serif',paddingBottom:'4rem',width:'100%'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 2rem',borderBottom:'1px solid #2d1f4e',background:'#130d24',flexWrap:'wrap',gap:'0.75rem',width:'100%'},
  logo:{fontSize:'1.3rem',fontWeight:700,color:'#c084fc'},
  sub:{fontSize:'0.75rem',color:'#a78bfa',marginTop:2},
  headerRight:{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'},
  blockBadge:{background:'#1e1333',border:'1px solid #6d28d9',borderRadius:20,padding:'4px 14px',fontSize:'0.8rem',color:'#c084fc'},
  navBtn:{background:'#1e1333',color:'#e6edf3',border:'1px solid #4c1d95',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:'0.8rem',display:'inline-flex',alignItems:'center',gap:6},
  badge:{background:'#7c3aed',color:'#fff',borderRadius:99,padding:'1px 7px',fontSize:11,fontWeight:700},
  connectBtn:{background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:700,cursor:'pointer',fontSize:'0.9rem'},
  accountBadge:{background:'#1e1333',border:'1px solid #6d28d9',borderRadius:10,padding:'6px 14px',fontSize:'0.8rem',color:'#c084fc',textAlign:'right'},
  balSmall:{fontSize:'0.7rem',color:'#a78bfa',marginTop:1},
  errorBox:{margin:'1rem 2rem',padding:'0.75rem 1rem',background:'#2d1b1b',border:'1px solid #f85149',borderRadius:8,color:'#f85149',fontSize:'0.9rem'},
  successBox:{padding:'0.75rem 1rem',background:'#1e1333',border:'1px solid #7c3aed',borderRadius:8,color:'#c084fc',fontSize:'0.9rem'},
  center:{display:'flex',justifyContent:'center',padding:'2rem 1rem',width:'100%'},
  homeCard:{background:'#130d24',border:'1px solid #4c1d95',borderRadius:16,padding:'2rem',maxWidth:560,width:'100%',textAlign:'center'},
  homeTitle:{fontSize:'1.4rem',fontWeight:700,marginBottom:'0.5rem',color:'#e9d5ff'},
  homeDesc:{fontSize:'0.9rem',color:'#a78bfa',marginBottom:'1.5rem',lineHeight:1.6},
  countdownBanner:{background:'#1a1000',border:'1px solid #854d0e',borderRadius:12,padding:'1.25rem',margin:'0.75rem 0 1rem'},
  rulesGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:'1.25rem'},
  ruleBox:{background:'#1e1333',borderRadius:10,padding:'0.75rem',border:'1px solid #4c1d95'},
  ruleVal:{fontSize:'1.1rem',fontWeight:700,color:'#c084fc'},
  ruleLbl:{fontSize:'0.75rem',color:'#a78bfa',marginTop:2},
  bigBtn:{width:'100%',padding:'0.85rem',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',border:'none',borderRadius:10,fontWeight:700,fontSize:'1rem',cursor:'pointer'},
  miniLb:{marginTop:'1.25rem',textAlign:'left',borderTop:'1px solid #4c1d95',paddingTop:'1rem'},
  miniLbTitle:{fontWeight:600,marginBottom:'0.5rem',color:'#c084fc',fontSize:'0.9rem'},
  miniLbRow:{display:'flex',alignItems:'center',gap:10,padding:'0.4rem 0',borderBottom:'1px solid #2d1f4e'},
  quizCard:{background:'#130d24',border:'1px solid #4c1d95',borderRadius:16,padding:'2rem',maxWidth:600,width:'100%'},
  progressRow:{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'},
  progressTrack:{height:4,background:'#2d1f4e',borderRadius:4,marginBottom:'1rem'},
  progressFill:{height:4,background:'linear-gradient(90deg,#7c3aed,#a855f7)',borderRadius:4,transition:'width .3s'},
  timerRow:{display:'flex',alignItems:'center',gap:10,marginBottom:'1.25rem'},
  timerTrack:{flex:1,height:6,background:'#2d1f4e',borderRadius:4,overflow:'hidden'},
  timerFill:{height:6,borderRadius:4,transition:'width 1s linear, background .5s'},
  questionText:{fontSize:'1.1rem',fontWeight:600,marginBottom:'1.5rem',lineHeight:1.5,color:'#e9d5ff'},
  optionsGrid:{display:'flex',flexDirection:'column',gap:'0.6rem'},
  optBtn:{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'0.75rem 1rem',background:'#1e1333',border:'1px solid #4c1d95',borderRadius:10,color:'#e6edf3',cursor:'pointer',fontSize:'0.9rem',textAlign:'left'},
  optCorrect:{background:'#1a2b1a',border:'1px solid #22c55e',color:'#22c55e'},
  optWrong:{background:'#2d1b1b',border:'1px solid #ef4444',color:'#ef4444'},
  optLetter:{width:24,height:24,borderRadius:6,background:'#4c1d95',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,flexShrink:0,color:'#e9d5ff'},
  scoreDisplay:{fontSize:'3rem',fontWeight:700,color:'#c084fc',margin:'0.5rem 0'},
  potEarned:{fontSize:'0.9rem',color:'#a78bfa',marginBottom:'0.5rem'},
  bonusBanner:{background:'#1e1333',border:'1px solid #a78bfa',borderRadius:12,padding:'1rem',margin:'0.75rem 0',color:'#c4b5fd'},
  missedBonus:{fontSize:'0.8rem',color:'#a78bfa',margin:'0.5rem 0',padding:'0.5rem',background:'#1e1333',borderRadius:8,border:'1px solid #4c1d95'},
  chainProof:{fontSize:'0.75rem',color:'#a78bfa',background:'#1e1333',borderRadius:8,padding:'6px 12px',display:'inline-block',marginTop:'0.5rem',border:'1px solid #4c1d95'},
  reviewRow:{display:'flex',alignItems:'center',padding:'0.5rem 0.75rem',border:'1px solid',borderRadius:8,marginBottom:'0.4rem'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem'},
  th:{padding:'0.6rem 0.75rem',textAlign:'left',color:'#a78bfa',borderBottom:'1px solid #2d1f4e',fontWeight:500},
  td:{padding:'0.65rem 0.75rem',borderBottom:'1px solid #2d1f4e'},
  tr:{background:'transparent'},
  trGold:{background:'#2a1f3d'},
  trSilver:{background:'#1e1333'},
  trBronze:{background:'#170f2e'},
  sectionBox:{background:'#0d0a14',border:'1px solid #2d1f4e',borderRadius:12,padding:'1.25rem',marginBottom:'1rem'},
  sectionTitle:{fontWeight:600,color:'#e9d5ff',marginBottom:'0.75rem',display:'flex',alignItems:'center',gap:8},
  formLabel:{fontSize:'0.8rem',color:'#a78bfa',marginBottom:'0.4rem',fontWeight:500},
  input:{width:'100%',background:'#1e1333',border:'1px solid #4c1d95',borderRadius:8,padding:'0.6rem 0.85rem',color:'#e6edf3',fontSize:'0.9rem',marginBottom:'0.5rem',boxSizing:'border-box'},
  scorePickBtn:{padding:'6px 16px',background:'#1e1333',border:'1px solid #4c1d95',borderRadius:8,color:'#e6edf3',cursor:'pointer',fontSize:'0.9rem'},
  scorePickActive:{background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',border:'1px solid #7c3aed',fontWeight:700},
  claimRow:{display:'flex',alignItems:'center',gap:10,padding:'0.75rem',background:'#1e1333',borderRadius:10,marginBottom:'0.5rem',border:'1px solid #4c1d95'},
  sendBtn:{background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontWeight:700,cursor:'pointer',fontSize:'0.85rem'},
  qRow:{display:'flex',alignItems:'center',gap:10,padding:'0.6rem 0.75rem',background:'#1e1333',borderRadius:8,marginBottom:'0.5rem',border:'1px solid #2d1f4e'},
  deleteBtn:{background:'#2d1b1b',border:'1px solid #f8514933',color:'#f85149',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12},
}