"""The words of the Corporate Luck by Chance landing page, How it works page and Brochure. Short, plain, close group (never the banned word), English only.
True facts only: docs-games RULES_luckbychance.md and OPTIONS_TABLES.md (10 rounds, 10 dice rounds in each, a 10 second press window).
Prices come from packages/shared/src/pricing.ts (the same numbers the structured data and the price card use)."""

TITLE = "Corporate Luck by Chance | Online dice game for company events"
DESC = "A dice game of pure luck for your close group at company events. Share one link, players join on their own phone with a name. Players never pay. Free demo game for 10 people."

TRUST = [
    "Designed for the engagement of company employees and their extended families.",
    "Close group online engagement and fun.",
    "Players never pay.",
    "Only the people you invite can join.",
    "No app to install.",
    "Player details are erased within 24 hours.",
    "A free demo game for 10 people.",
    "Designed to follow the EU GDPR, US privacy laws and India&rsquo;s DPDP Act.",
]

DAY = [
    ("You share one link", "Send it by WhatsApp, e-mail or your intranet, only to the people you invite."),
    ("Everyone presses the dice", "Each person plays on their own phone. A target number appears, and the software finds every winner."),
    ("Winners are cheered", "You get a report by e-mail. Player details are erased within 24 hours."),
]

BENEFITS = [
    ("One link, any place", "Share one link by WhatsApp, e-mail, Slack or Teams. It works for remote, hybrid and in-room teams. Only the people you invite can join."),
    ("Just a name to join", "Players type a display name and they are in. No app to download and no account."),
    ("Clear screens", "A big target number, a big dice button and a top 10 list. A big-screen page works for a projector or a shared video call."),
    ("Fair by design", "Every target and every dice comes from a public random number that does not exist until its moment. Nobody can know a result in advance, not even us. Anyone can re-check it afterwards."),
    ("A place for every player", "Equal points are settled by the highest single hit, then the most hits, then who got there first, then a public random number. The ranking has no ties."),
    ("Your own moments", "Add your logo and your own message or video for everyone to see. Great for an opening or a closing word."),
    ("Details erased", "Player names are erased within 24 hours of the game ending. We keep only the winners record and the organizer&rsquo;s details for 365 days. We never e-mail players and never sell data."),
    ("A report when it ends", "The organizer gets a report link by e-mail soon after the game ends, with a PDF to share."),
]

OCCASIONS = ["Virtual holiday party", "All-hands opener", "New-hire welcome", "Customer event", "Friday team break", "Team offsite", "Diwali party"]

# (question, answer as html, answer as plain text for the search-engine data). The first six also go to the structured data.
FAQ = [
    ("How do I set up a game?",
     "Sign in with your e-mail and follow the short steps in the organizer console, or use the free AI assistant. Building and publishing a game are free. You pay once, before the game starts.",
     "Sign in with your e-mail and follow the short steps in the organizer console, or use the free AI assistant. Building and publishing a game are free. You pay once, before the game starts."),
    ("Do players pay or install anything?",
     "No. Players never pay and there is no app to download. They open your link and type a display name. Nothing else is asked.",
     "No. Players never pay and there is no app to download. They open your link and type a display name. Nothing else is asked."),
    ("Is there any prize money?",
     "No. Players never pay and never stake money. There are no cash prizes and no betting. Any gift is supplied by the organizer, outside the product. Corporate Luck by Chance is software only: we never hold or pay prize money. It is for adults (18+), at company events.",
     "No. Players never pay and never stake money. There are no cash prizes and no betting. Any gift is supplied by the organizer, outside the product. Corporate Luck by Chance is software only: we never hold or pay prize money. It is for adults (18+), at company events."),
    ("Who decides the winners?",
     "The software only, from public random numbers. Every phone works out every score itself and a result counts only when enough phones agree. No person, including the organizer and us, can change a target, a dice or a result.",
     "The software only, from public random numbers. No person, including the organizer and us, can change a target, a dice or a result."),
    ("How does the game play?",
     "A target number from 1 to 6 appears. Everyone presses the dice. A player whose dice shows the target scores that many points; everyone else scores nothing. A game has 10 rounds and each round has 10 dice rounds. You have 10 seconds to press. It is pure luck: there is no skill. Read <a href=\"/how-it-works\">how it works</a>.",
     "A target number from 1 to 6 appears. Everyone presses the dice. A player whose dice shows the target scores that many points; everyone else scores nothing. A game has 10 rounds and each round has 10 dice rounds. You have 10 seconds to press. It is pure luck: there is no skill."),
    ("How big can a game be?",
     "Up to the size of your pack. The game itself runs on the players&rsquo; phones, so a crowd costs nothing extra while it plays. There is also a big-screen page for a projector.",
     "Up to the size of your pack. The game itself runs on the players' phones, so a crowd costs nothing extra while it plays. There is also a big-screen page for a projector."),
    ("How is the ranking decided?",
     "There are no ties. The order is the most points, then the highest single hit, then the most hits, then who reached the score first, then fate (a public random number). 1st to 5th are named and a top 10 is listed, with one line saying how each tie was decided.",
     ""),
    ("What if a player loses the connection?",
     "They can open the link again and the screen catches up by itself: the numbers are public, so nothing is lost.",
     ""),
    ("How is the organizer verified?",
     "Through the 6-digit code we send to your e-mail. There is no password to remember.",
     ""),
    ("What happens to the data?",
     "Player names (and mobile numbers, if asked) are erased within 24 hours after the game ends. We keep the winners record and the organizer&rsquo;s details for 365 days, then delete them automatically. A game that never starts is treated the same way. Corporate Luck by Chance is designed to follow India&rsquo;s DPDP Act, the EU GDPR and US state privacy laws such as the CCPA. Read the <a href=\"/privacy.html\">privacy notice</a>.",
     ""),
    ("Can people in other countries play?",
     "Yes. Anyone with the link can play on their own phone, in any country.",
     ""),
]

HOW_STEPS = [
    ("Build your game", "Sign in with your e-mail. Pick the day, the time and the size. Add the gifts for places 1 to 5 and, if you like, your logo and your own message. Building and publishing are free."),
    ("Share one link", "Send it by WhatsApp, e-mail, Slack or Teams, or show it on a big screen. Only the people you invite can join."),
    ("Players join with a name", "They open the link and type a display name. No app, no account, nothing to pay."),
    ("Everyone presses the dice", "A target number from 1 to 6 appears. When the press window opens, everyone presses the dice. If your dice shows the target, you score that many points. Otherwise you score nothing."),
    ("Winners and a report", "The software names 1st to 5th and lists a top 10. Any gift is yours to give, outside the product. A report arrives by e-mail."),
]

# what a game looks like: from RULES_luckbychance.md section 1 and 3
GAME_FACTS = [
    ("Rounds in a game", "10"),
    ("Dice rounds in each round", "10, so 100 in all"),
    ("Press window", "10 seconds"),
    ("Result shown for", "3 seconds"),
    ("Break after each round", "20 seconds, to show the standings"),
    ("Time in all", "About 25 minutes when the software runs the game"),
]

BROCHURE_WHY = [
    ("Ready in minutes", "Pick the day, the size and the gifts. It is a free draft until you publish."),
    ("Everyone plays on their phone", "Players open one link and type a name. Press the dice and watch it roll."),
    ("Your brand in the game", "Add your logo and your own message or video for everyone to see."),
    ("Fair for everyone", "The software, not a person, makes every target and every dice from public random numbers. Anyone can check afterwards."),
    ("Your team can help", "You, up to 5 Hosts and any number of Co-hosts. Only one payment is needed, from any one of you."),
    ("A free AI helper", "Paste your AI link into your own AI chat. It builds the draft. You press publish and pay."),
    ("Players pay nothing", "No cash prizes, no betting. Any gift is supplied by you, outside the product."),
    ("Easy to explain", "Player names are erased within 24 hours after the game. Designed to follow India&rsquo;s DPDP Act, the EU GDPR and US state privacy laws."),
]

BROCHURE_INCLUDES = [
    "10 rounds of 10 dice rounds, a 10 second press window, gifts for places 1 to 5",
    "A ranking with no ties: 1st to 5th named, a top 10 listed",
    "A spectator view and a big-screen page for a projector or a video call",
    "A report link e-mailed to you after the game",
    "A free demo game for 10 people, so you can try it before you decide",
]
