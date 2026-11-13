import React, { useEffect } from "react";
import Navbar from "src/components/Navbar";
import { useLiveGameContext } from "src/context/useLiveGameContext";
import PlayerTable from "./components/PlayerTable";
import StatsSection from "./components/StatsSection";
import GameOver from "./GameOver";
import DiceSection from "./components/DiceSection";
import StatsSectionMobile from "./components/StatsSectionMobile";
import CurrentPlayerMobile from "./components/CurrentPlayerMobile";
import DiceSectionMobile from "./components/DiceSectionMobile";
import ApiErrorBanner from "src/components/ApiErrorBanner";
import FeedbackMessage from "src/components/FeedbackMessage";
import HotStreakBanner from "src/components/HotStreakBanner";
import BonusPopup from "src/components/BonusPopup";
import ScreenReaderAnnouncer from "src/components/ScreenReaderAnnouncer";
import KeyboardShortcuts from "src/components/KeyboardShortcuts";

export default function LiveGame() {
  const { playerData, currentPlayer, isGameOver, winnerId, setIsContinue } = useLiveGameContext();

  useEffect(() => {
    setIsContinue(true)
  }, [])
  
  return (
    <div className="md:grid md:grid-cols-[minmax(auto,_200px)_1fr_minmax(auto,_200px)] lg:grid-cols-[minmax(auto,_250px)_1fr_minmax(auto,_250px)] xl:grid-cols-[auto_1fr_minmax(auto,_300px)] relative">
      <ApiErrorBanner showSetupLink />
      <FeedbackMessage />
      <BonusPopup />
       <ScreenReaderAnnouncer />
       <KeyboardShortcuts />
      <DiceSection />
      <div className=" space-y-2 p-2">
        <Navbar />
        <HotStreakBanner />
        <PlayerTable playerData={playerData} currentPlayer={currentPlayer} />
      </div>
      <CurrentPlayerMobile playerData={playerData} currentPlayer={currentPlayer}/>
      <DiceSectionMobile />

      <StatsSection playerData={playerData} currentPlayer={currentPlayer} />
      <StatsSectionMobile playerData={playerData} currentPlayer={currentPlayer} />
      {isGameOver ? (
        <GameOver playerData={playerData} currentPlayer={currentPlayer} winnerId={winnerId} setIsContinue={setIsContinue} />
      ) : (
        <></>
      )}
    </div>
  );
}
