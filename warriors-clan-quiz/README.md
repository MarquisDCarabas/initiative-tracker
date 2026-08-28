# Clanborn — a Warriors Clan quiz

A standalone, self-contained sorting quiz for young readers of Erin Hunter's
**Warriors** series, modelled on the official Pottermore/Wizarding World
Sorting Hat quiz.

Open `index.html` in any browser. There is no build step and no dependency —
the only external request is the Google Fonts stylesheet, and the page falls
back to system faces if it is unavailable.

## How it works

* **26 questions in the bank.** Each sitting asks **8**: one from three
  openers, six drawn at random from a pool of twenty, and one from three
  closers — so a second attempt is a genuinely different quiz. This mirrors
  how the Pottermore quiz deals its questions.
* **Weighted scoring.** Every answer spreads exactly 100 points across the
  five Clans, so no answer is a throwaway and none maps one-to-one onto a
  Clan. Questions are indirect by design — imagery, preferences and
  dilemmas rather than "are you brave?".
* **Ties** go to whichever Clan a single answer called to most strongly.
* The result shows the Clan, why it chose you, its territory and hunting
  style, a percentage breakdown of how loudly each Clan called, and a
  generated warrior name.

## Clan traits

Drawn from the series and its field guides (*Secrets of the Clans*,
*Battles of the Clans*):

| Clan | Territory | Character |
| --- | --- | --- |
| ThunderClan | Oak forest, camp in a stone hollow | Brave, warm-hearted, protects outsiders, argues with the code |
| ShadowClan | Pine and marsh | Proud, guarded, strategic, hunts in full dark |
| WindClan | Open moor | Swift, alert, restless, easily offended, closest to StarClan |
| RiverClan | River and reed beds | Calm, patient, clever, well-fed, fond of beautiful things |
| SkyClan | Sandstone gorge, tall trees | Adaptable, welcoming, rebuilt from outsiders, leaps |

## Balance

The weights are tuned so the quiz is neither biased nor unresponsive. Under
uniformly random answering the five Clans come out at 18.5–21.3% (even would
be 20%), while a reader who answers consistently in one Clan's direction
lands in that Clan 100% of the time.

Unofficial fan work. *Warriors* is created by Erin Hunter.
