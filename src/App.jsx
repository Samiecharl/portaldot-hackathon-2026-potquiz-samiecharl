import { useState, useEffect, useCallback } from 'react'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'

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

  useEffect(() => {
    async function connect() {
      try {
        const provider = new WsProvider('ws://127.0.0.1:9944')
        const _api = await ApiPromise.create({ provider })
        setApi(_api)
        _api.rpc.chain.subscribeNewHeads(h => setBlock(h.number.toNumber()))
      } catch {
        setError('Cannot reach Portaldot node. Make sure it is running.')
      }
    }
    connect()
    const saved = localStorage.getItem('pot_questions')
    if (saved) setQuestions(JSON.parse(saved))
    const lb = localStorage.getItem('pot_leaderboard')
    if (lb) setLeaderboard(JSON.parse(lb))
    const cl = localStorage.getItem('pot_claims')
    if (cl) setClaims(JSON.parse(cl))
    const settings = localStorage.getItem('pot_settings')
    if (settings) {
      const s = JSON.parse(settings)
      setMinScore(s.minScore ?? 4)
      setBonusPot(s.bonusPot ?? 2)
      setQuestionsPerRound(s.questionsPerRound ?? 5)
      setTimePerQuestion(s.timePerQuestion ?? 15)
    }
  }, [])

  const refreshBalance = useCallback(async (addr) => {
    if (!api || !addr) return
    const { data } = await api.query.system.account(addr)
    setBalance(data.free.toBigInt())
  }, [api])

  useEffect(() => {
    if (account) refreshBalance(account.address)
  }, [account, refreshBalance])

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
    setResults(r => [...r, {
      q: activeQuestions[qIndex].q,
      correct,
      chosen: idx,
      answer: activeQuestions[qIndex].answer
    }])

    setTimeout(async () => {
      if (qIndex + 1 >= activeQuestions.length) {
        if (api && account) {
          try {
            const injector = await web3FromAddress(account.address)
            const remark = `POTQUIZ:${playerName}:${newScore}/${activeQuestions.length}:BLOCK${block}`
            api.tx.system.remark(remark)
              .signAndSend(account.address, { signer: injector.signer })
              .catch(() => {})
          } catch {}
        }
        if (newScore >= minScore && account) {
          const newClaim = {
            id: Date.now(),
            address: account.address,
            short: playerName || `${account.address.slice(0,6)}…${account.address.slice(-4)}`,
            score: newScore,
            total: activeQuestions.length,
            bonus: bonusPot,
            block: block || 0,
            date: new Date().toLocaleDateString(),
            status: 'pending'
          }
          if (api && account) {
            try {
              const injector = await web3FromAddress(account.address)
              const remark = `BONUS_CLAIM:${playerName}:${bonusPot}POT:SCORE${newScore}/${activeQuestions.length}`
              api.tx.system.remark(remark)
                .signAndSend(account.address, { signer: injector.signer })
                .catch(() => {})
            } catch {}
          }
          const updatedClaims = [...claims, newClaim]
          setClaims(updatedClaims)
          localStorage.setItem('pot_claims', JSON.stringify(updatedClaims))
        }
        const entry = {
          address: account?.address || 'Unknown',
          short: playerName || (account ? `${account.address.slice(0,6)}…${account.address.slice(-4)}` : 'Unknown'),
          score: newScore,
          total: activeQuestions.length,
          pot: (newScore * REWARD_PER_Q).toFixed(1),
          bonus: newScore >= minScore ? bonusPot : 0,
          block: block || 0,
          date: new Date().toLocaleDateString()
        }
        const newLb = [...leaderboard, entry]
          .sort((a, b) => b.score - a.score)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        setLeaderboard(newLb)
        localStorage.setItem('pot_leaderboard', JSON.stringify(newLb))
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
    setSendingClaim(claim.id)
    setClaimMsg('')
    if (claim.address === account.address) {
      await new Promise(r => setTimeout(r, 1500))
      const updated = claims.map(c => c.id === claim.id ? { ...c, status: 'paid' } : c)
      setClaims(updated)
      localStorage.setItem('pot_claims', JSON.stringify(updated))
      setClaimMsg(`✅ ${claim.bonus} POT bonus recorded for ${claim.short}!`)
      setSendingClaim(null)
      return
    }
    try {
      const injector = await web3FromAddress(account.address)
      const amount = BigInt(claim.bonus) * POT_DECIMALS
      await new Promise((resolve, reject) => {
        api.tx.balances.transferKeepAlive(claim.address, amount)
          .signAndSend(account.address, { signer: injector.signer }, ({ status }) => {
            if (status.isInBlock) resolve()
            if (status.isDropped || status.isInvalid) reject(new Error('Failed'))
          })
      })
      const updated = claims.map(c => c.id === claim.id ? { ...c, status: 'paid' } : c)
      setClaims(updated)
      localStorage.setItem('pot_claims', JSON.stringify(updated))
      setClaimMsg(`✅ Sent ${claim.bonus} POT to ${claim.short}!`)
    } catch (e) {
      setClaimMsg('❌ Transfer failed: ' + e.message)
    }
    setSendingClaim(null)
  }

  function shareScore() {
    const text = `🧠 ${playerName} just scored ${score}/${activeQuestions.length} on the POT Quiz!\n\n⛓ Score saved on Portaldot blockchain · Block #${block}\n💰 Earned ${(score * REWARD_PER_Q).toFixed(1)} POT${score >= minScore ? ` + ${bonusPot} POT bonus! 🎁` : ''}\n\nPlay at http://localhost:5174`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  function saveSettings() {
    localStorage.setItem('pot_settings', JSON.stringify({ minScore, bonusPot, questionsPerRound, timePerQuestion }))
    setAdminMsg(`✅ Saved! ${questionsPerRound} questions per round, ${timePerQuestion}s timer. Score ${minScore}+ earns ${bonusPot} bonus POT.`)
  }

  function addQuestion() {
    if (!adminQ.trim()) { setAdminMsg('Enter a question.'); return }
    if (adminOpts.some(o => !o.trim())) { setAdminMsg('Fill in all 4 options.'); return }
    const newQ = { q: adminQ, options: adminOpts, answer: adminAnswer }
    const updated = [...questions, newQ]
    setQuestions(updated)
    localStorage.setItem('pot_questions', JSON.stringify(updated))
    setAdminQ('')
    setAdminOpts(['', '', '', ''])
    setAdminAnswer(0)
    setAdminMsg(`✅ Question added! You now have ${updated.length} questions.`)
  }

  function deleteQuestion(i) {
    const updated = questions.filter((_, idx) => idx !== i)
    setQuestions(updated)
    localStorage.setItem('pot_questions', JSON.stringify(updated))
  }

  function resetQuestions() {
    setQuestions(DEFAULT_QUESTIONS)
    localStorage.setItem('pot_questions', JSON.stringify(DEFAULT_QUESTIONS))
    setAdminMsg('✅ Reset to default questions.')
  }

  function clearLeaderboard() {
    setLeaderboard([])
    localStorage.removeItem('pot_leaderboard')
  }

  function playAgain() {
    setPhase('home')
    setScore(0)
    setResults([])
    setSelected(null)
    setAnswered(false)
    setTimer(timePerQuestion)
    setQIndex(0)
    setNameInput('')
    setError('')
    setCopied(false)
  }

  const timerPct = (timer / timePerQuestion) * 100
  const timerColor = timer > 8 ? '#22c55e' : timer > 4 ? '#f59e0b' : '#ef4444'
  const fmt = (v) => v ? (Number(v) / 1e10).toFixed(2) : '0.00'
  const pendingClaims = claims.filter(c => c.status === 'pending')

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/logo.png" alt="Portaldot" style={{width:36,height:36,borderRadius:'50%'}}/>
            <div style={S.logo}>Portaldot Trivia Quiz</div>
          </div>
          <div style={S.sub}>Blockchain Trivia on Portaldot</div>
        </div>
        <div style={S.headerRight}>
          {block && <div style={S.blockBadge}>⛓ Block #{block}</div>}
          <button style={S.navBtn} onClick={() => setPhase('leaderboard')}>🏆 Leaderboard</button>
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

      {/* HOME */}
      {phase === 'home' && (
        <div style={S.center}>
          <div style={S.homeCard}>
            <img src="/logo.png" alt="Portaldot" style={{width:80,height:80,borderRadius:'50%',marginBottom:'0.75rem'}}/>
            <div style={S.homeTitle}>Portaldot Trivia Quiz</div>
            <div style={S.homeDesc}>Test your blockchain knowledge. Score <strong style={{color:'#f0c040'}}>{minScore}/{questionsPerRound}+</strong> to win a <strong style={{color:'#f0c040'}}>{bonusPot} POT bonus</strong> sent to your wallet!</div>
            <div style={S.rulesGrid}>
              <div style={S.ruleBox}><div style={S.ruleVal}>{questionsPerRound}</div><div style={S.ruleLbl}>Questions</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{REWARD_PER_Q} POT</div><div style={S.ruleLbl}>Per correct</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{minScore}+</div><div style={S.ruleLbl}>Bonus threshold</div></div>
              <div style={S.ruleBox}><div style={S.ruleVal}>{bonusPot} POT</div><div style={S.ruleLbl}>Bonus prize</div></div>
            </div>
            {!account
              ? <button style={S.bigBtn} onClick={connectWallet}>Connect Wallet to Play</button>
              : <button style={S.bigBtn} onClick={goToWelcome}>Start Quiz →</button>
            }
            {leaderboard.length > 0 && (
              <div style={S.miniLb}>
                <div style={S.miniLbTitle}>🏆 Top Players</div>
                {leaderboard.slice(0, 3).map((e, i) => (
                  <div key={i} style={S.miniLbRow}>
                    <span>{['🥇','🥈','🥉'][i]}</span>
                    <span style={{flex:1,color:'#8b949e',fontSize:13}}>{e.short}</span>
                    <span style={{color:'#f0c040',fontWeight:700}}>{e.score}/{e.total || 5}</span>
                    {e.bonus > 0 && <span style={{color:'#a78bfa',fontSize:12}}>+{e.bonus} POT 🎁</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WELCOME */}
      {phase === 'welcome' && (
        <div style={S.center}>
          <div style={S.homeCard}>
            <div style={{fontSize:48,marginBottom:'0.75rem'}}>👋</div>
            <div style={S.homeTitle}>What's your name?</div>
            <div style={S.homeDesc}>Your name will appear on the leaderboard for everyone to see.</div>
            {error && <div style={{...S.errorBox,margin:'0 0 1rem'}}>{error}</div>}
            <input
              style={{...S.input,fontSize:'1.1rem',textAlign:'center',marginBottom:'1rem'}}
              placeholder="Enter your name..."
              value={nameInput}
              maxLength={20}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startGame()}
              autoFocus
            />
            <div style={{fontSize:12,color:'#8b949e',marginBottom:'1rem'}}>
              Playing as: <strong style={{color:'#f0c040'}}>{account?.address.slice(0,6)}…{account?.address.slice(-4)}</strong>
            </div>
            <button style={S.bigBtn} onClick={startGame}>Let's Play! 🚀</button>
            <button style={{...S.bigBtn,background:'#21262d',color:'#e6edf3',marginTop:'0.5rem'}}
              onClick={() => { setPhase('home'); setError('') }}>← Back</button>
          </div>
        </div>
      )}

      {/* QUIZ */}
      {phase === 'quiz' && activeQuestions.length > 0 && (
        <div style={S.center}>
          <div style={S.quizCard}>
            <div style={S.progressRow}>
              <span style={{fontSize:'0.8rem',color:'#8b949e'}}>
                {playerName && <span style={{color:'#f0c040',fontWeight:600}}>{playerName} · </span>}
                Question {qIndex+1} of {activeQuestions.length}
              </span>
              <span style={{fontSize:'0.8rem',color:'#f0c040',fontWeight:600}}>Score: {score}</span>
            </div>
            <div style={S.progressTrack}>
              <div style={{...S.progressFill,width:`${(qIndex/activeQuestions.length)*100}%`}}/>
            </div>
            <div style={S.timerRow}>
              <div style={S.timerTrack}>
                <div style={{...S.timerFill,width:`${timerPct}%`,background:timerColor}}/>
              </div>
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

      {/* RESULT */}
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
                <div style={{fontSize:'0.85rem',marginTop:4}}>
                  You scored {score}/{activeQuestions.length} — you qualify for the <strong>{bonusPot} POT bonus!</strong>
                </div>
                <div style={{fontSize:'0.75rem',color:'#8b949e',marginTop:6}}>
                  Your claim is recorded on-chain. The admin will send your bonus POT shortly.
                </div>
              </div>
            )}
            {score < minScore && (
              <div style={S.missedBonus}>
                Score {minScore}/{activeQuestions.length} or above to unlock the {bonusPot} POT bonus next time!
              </div>
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
            <button style={{...S.bigBtn,marginTop:'1.25rem',background:copied?'#22c55e':'#1d4ed8',color:'#fff'}}
              onClick={shareScore}>
              {copied ? '✅ Copied to clipboard!' : '📤 Share my score'}
            </button>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'0.5rem',width:'100%'}}>
              <button style={{...S.bigBtn,flex:1}} onClick={playAgain}>Play Again</button>
              <button style={{...S.bigBtn,flex:1,background:'#21262d',color:'#e6edf3'}} onClick={() => setPhase('leaderboard')}>🏆 Leaderboard</button>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {phase === 'leaderboard' && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:750,textAlign:'left'}}>
            <div style={{...S.homeTitle,textAlign:'center'}}>🏆 Leaderboard</div>
            <div style={{...S.homeDesc,textAlign:'center'}}>Top scores on the Portaldot blockchain</div>
            {leaderboard.length === 0
              ? <div style={{color:'#8b949e',padding:'2rem',textAlign:'center'}}>No scores yet — play the quiz first!</div>
              : <table style={S.table}>
                  <thead>
                    <tr>{['Rank','Player','Score','POT Earned','Bonus','Block','Date'].map(h=>(
                      <th key={h} style={S.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((e,i)=>(
                      <tr key={i} style={i===0?S.trGold:i===1?S.trSilver:i===2?S.trBronze:S.tr}>
                        <td style={S.td}>{e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':`#${e.rank}`}</td>
                        <td style={S.td}>{e.short}</td>
                        <td style={{...S.td,fontWeight:700,color:'#f0c040'}}>{e.score}/{e.total||5}</td>
                        <td style={{...S.td,color:'#22c55e'}}>{e.pot} POT</td>
                        <td style={{...S.td,color:'#a78bfa'}}>{e.bonus>0?`+${e.bonus} POT 🎁`:'—'}</td>
                        <td style={{...S.td,color:'#8b949e'}}>#{e.block}</td>
                        <td style={{...S.td,color:'#8b949e'}}>{e.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.25rem'}}>
              <button style={{...S.bigBtn,flex:1}} onClick={()=>setPhase('home')}>← Back</button>
              {leaderboard.length>0&&<button style={{...S.bigBtn,flex:1,background:'#2d1b1b',color:'#f85149'}} onClick={clearLeaderboard}>Clear</button>}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LOCK */}
      {phase === 'admin' && !adminUnlocked && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:380}}>
            <div style={{fontSize:48,marginBottom:'0.75rem'}}>🔒</div>
            <div style={S.homeTitle}>Admin Access</div>
            <div style={S.homeDesc}>Enter the admin password to continue</div>
            <input
              type="password"
              style={{...S.input,textAlign:'center',fontSize:'1rem',marginBottom:'0.75rem'}}
              placeholder="Enter password"
              value={enteredPassword}
              onChange={e=>setEnteredPassword(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter'){
                  if(enteredPassword===adminPassword){setAdminUnlocked(true);setEnteredPassword('')}
                  else setAdminMsg('❌ Wrong password.')
                }
              }}
            />
            {adminMsg&&<div style={{color:'#f85149',fontSize:13,marginBottom:'0.75rem'}}>{adminMsg}</div>}
            <button style={S.bigBtn} onClick={()=>{
              if(enteredPassword===adminPassword){setAdminUnlocked(true);setEnteredPassword('')}
              else setAdminMsg('❌ Wrong password. Try again.')
            }}>Unlock Admin</button>
            <button style={{...S.bigBtn,background:'#21262d',color:'#e6edf3',marginTop:'0.5rem'}}
              onClick={()=>{setPhase('home');setEnteredPassword('');setAdminMsg('')}}>← Back</button>
          </div>
        </div>
      )}

      {/* ADMIN PANEL */}
      {phase === 'admin' && adminUnlocked && (
        <div style={S.center}>
          <div style={{...S.homeCard,maxWidth:680,textAlign:'left'}}>
            <div style={{...S.homeTitle,textAlign:'center'}}>⚙️ Admin Panel</div>
            {adminMsg&&<div style={{...S.successBox,marginBottom:'1rem'}}>{adminMsg}</div>}
            {claimMsg&&<div style={{...S.successBox,marginBottom:'1rem'}}>{claimMsg}</div>}

            {/* Settings */}
            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>🎮 Game Settings</div>
              <div style={S.formLabel}>Seconds per question</div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'0.75rem'}}>
                <input type="number" min={5} max={50} value={timePerQuestion}
                  onChange={e=>setTimePerQuestion(Number(e.target.value))}
                  style={{...S.input,width:80,marginBottom:0,textAlign:'center'}}/>
                <span style={{fontSize:13,color:'#8b949e'}}>seconds (min 5, max 50)</span>
              </div>
              <div style={S.formLabel}>Questions per round</div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'0.75rem'}}>
                <input type="number" min={1} max={50} value={questionsPerRound}
                  onChange={e=>setQuestionsPerRound(Number(e.target.value))}
                  style={{...S.input,width:80,marginBottom:0,textAlign:'center'}}/>
                <span style={{fontSize:13,color:'#8b949e'}}>you have {questions.length} questions in your pool</span>
              </div>
              <div style={S.formLabel}>Minimum score to qualify for bonus</div>
              <div style={{display:'flex',gap:8,marginBottom:'0.75rem'}}>
                {[3,4,5].map(n=>(
                  <button key={n} style={{...S.scorePickBtn,...(minScore===n?S.scorePickActive:{})}} onClick={()=>setMinScore(n)}>{n}+</button>
                ))}
              </div>
              <div style={S.formLabel}>Bonus POT amount</div>
              <div style={{display:'flex',gap:8,marginBottom:'0.75rem'}}>
                {[1,2,3,5,10].map(n=>(
                  <button key={n} style={{...S.scorePickBtn,...(bonusPot===n?S.scorePickActive:{})}} onClick={()=>setBonusPot(n)}>{n} POT</button>
                ))}
              </div>
              <button style={S.bigBtn} onClick={saveSettings}>Save Settings</button>
            </div>

            {/* Claims */}
            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>
                💸 Pending Bonus Claims
                {pendingClaims.length>0&&<span style={S.badge}>{pendingClaims.length} pending</span>}
              </div>
              {pendingClaims.length===0
                ?<div style={{color:'#8b949e',fontSize:13,padding:'0.75rem 0'}}>No pending claims yet.</div>
                :pendingClaims.map(c=>(
                  <div key={c.id} style={S.claimRow}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#e6edf3'}}>{c.short}</div>
                      <div style={{fontSize:11,color:'#8b949e'}}>Score: {c.score}/{c.total||5} · Block #{c.block} · {c.date}</div>
                    </div>
                    <div style={{color:'#a78bfa',fontWeight:700,fontSize:14,marginRight:12}}>{c.bonus} POT</div>
                    <button style={{...S.sendBtn,opacity:sendingClaim===c.id?0.5:1}}
                      onClick={()=>sendBonus(c)} disabled={sendingClaim===c.id}>
                      {sendingClaim===c.id?'Sending…':'Send POT →'}
                    </button>
                  </div>
                ))
              }
              {claims.filter(c=>c.status==='paid').length>0&&(
                <div style={{marginTop:'0.75rem'}}>
                  <div style={{fontSize:12,color:'#8b949e',marginBottom:'0.4rem'}}>✅ Paid</div>
                  {claims.filter(c=>c.status==='paid').map(c=>(
                    <div key={c.id} style={{...S.claimRow,opacity:0.5}}>
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

            {/* Add question */}
            <div style={S.sectionBox}>
              <div style={S.sectionTitle}>✏️ Add Question</div>
              <div style={S.formLabel}>Question</div>
              <input style={S.input} placeholder="Type your question here..." value={adminQ} onChange={e=>setAdminQ(e.target.value)}/>
              <div style={S.formLabel}>Answer Options (select the correct one)</div>
              {adminOpts.map((opt,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <input type="radio" name="correct" checked={adminAnswer===i} onChange={()=>setAdminAnswer(i)} style={{accentColor:'#22c55e'}}/>
                  <input style={{...S.input,marginBottom:0,flex:1}} placeholder={`Option ${['A','B','C','D'][i]}`} value={opt}
                    onChange={e=>{const u=[...adminOpts];u[i]=e.target.value;setAdminOpts(u)}}/>
                  {adminAnswer===i&&<span style={{color:'#22c55e',fontSize:11}}>✓</span>}
                </div>
              ))}
              <button style={{...S.bigBtn,marginTop:'0.5rem'}} onClick={addQuestion}>Add Question</button>
            </div>

            {/* Questions list */}
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

            <button style={{...S.bigBtn,background:'#21262d',color:'#e6edf3'}}
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
  homeEmoji:{fontSize:52,marginBottom:'0.75rem'},
  homeTitle:{fontSize:'1.4rem',fontWeight:700,marginBottom:'0.5rem',color:'#e9d5ff'},
  homeDesc:{fontSize:'0.9rem',color:'#a78bfa',marginBottom:'1.5rem',lineHeight:1.6},
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