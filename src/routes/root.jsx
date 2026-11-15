import { Outlet, useLocation } from "react-router-dom";
import { GreedyPigContext } from "src/context/useGreedyPigContext";
import useImagePreloader from "src/hooks/useImagePreloader";
import Tutorial from "src/components/Tutorial";
import pig0 from "src/assets/pig-0.webp";
import pig1 from "src/assets/pig-1.webp";
import pig2 from "src/assets/pig-2.webp";
import pig3 from "src/assets/pig-3.webp";
import pig4 from "src/assets/pig-4.webp";
import pig5 from "src/assets/pig-5.webp";
import pig6 from "src/assets/pig-6.webp";
import pig7 from "src/assets/pig-7.webp";
import pig8 from "src/assets/pig-8.webp";
import pig9 from "src/assets/pig-9.webp";
import pig10 from "src/assets/pig-10.webp";
import pig11 from "src/assets/pig-11.webp";
import pig12 from "src/assets/pig-12.webp";
import pig13 from "src/assets/pig-13.webp";
import pig14 from "src/assets/pig-14.webp";
import pig15 from "src/assets/pig-15.webp";
import pig16 from "src/assets/pig-16.webp";
import pig17 from "src/assets/pig-17.webp"
import pig18 from "src/assets/pig-18.webp"
import pig19 from "src/assets/pig-19.webp"
import pig20 from "src/assets/pig-20.webp"
import pig21 from "src/assets/pig-21.webp"
import pig22 from "src/assets/pig-22.webp"
import pig23 from "src/assets/pig-23.webp"
import pig24 from "src/assets/pig-24.webp"
import pig25 from "src/assets/pig-25.webp"
import pig26 from "src/assets/pig-26.webp"
import pig27 from "src/assets/pig-27.webp"
import pig28 from "src/assets/pig-28.webp"
import dice1 from "src/assets/dice_1.webp";
import dice2 from "src/assets/dice_2.webp";
import dice3 from "src/assets/dice_3.webp";
import dice4 from "src/assets/dice_4.webp";
import dice5 from "src/assets/dice_5.webp";
import dice6 from "src/assets/dice_6.webp";
import { useEffect, useState } from "react";
import { getPigPetNames } from "src/utils/getPigPetNames";

const preloadSrcList = [
  pig0,
  pig1,
  pig2,
  pig3,
  pig4,
  pig5,
  pig6,
  pig7,
  pig8,
  pig9,
  pig10,
  pig11,
  pig12,
  pig13,
  pig14,
  pig15,
  pig16,
  pig17,
  pig18,
  pig19,
  pig20,
  pig22,
  pig23,
  pig24,
  pig25,
  pig26,
  pig27,
  pig28,
  pig21,
  dice1,
  dice2,
  dice3,
  dice4,
  dice5,
  dice6,
];
const pigPetNames = getPigPetNames();


function Root() {
  const { imagesPreloaded } = useImagePreloader(preloadSrcList);
  const location = useLocation();

  // Sound on or off, remembered between visits.
  const [hasSound, setHasSound] = useState(() => {
    try {
      return localStorage.getItem("gp-sound") !== "off";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("gp-sound", hasSound ? "on" : "off");
    } catch {
      // Storage can be blocked (private window). The game still works, just without remembering.
    }
  }, [hasSound]);

  // Show the tutorial whenever the page is loaded or reloaded on the home page.
  const [showTutorial, setShowTutorial] = useState(() => location.pathname === "/");

  function closeTutorial() {
    setShowTutorial(false);
  }

  if (!imagesPreloaded) {
    return (
      <>
        <main className="bg-[#111111] min-h-screen min-w-full relative z-10 sec-font ">
          <div className=" rounded-full bg-[#056FA4] blur-[845px] w-[800px] h-[800px] -z-10 fixed -bottom-96 -left-96"></div>
          <div className=" rounded-full bg-[#D30CBD] blur-[845px] w-[800px] h-[800px] -z-10 fixed -top-96 -right-96"></div>
          Preloading Assets
        </main>
      </>
    );
  }

  return (
    <>
      <main className="bg-[#111111] min-h-screen min-w-full relative z-10 sec-font ">
        <div className=" rounded-full bg-[#056FA4] blur-[500px] md:blur-[845px] w-[800px] h-[800px] -z-10 fixed -bottom-[700px] -left-[700px] md:-bottom-96 md:-left-96"></div>
        <div className=" rounded-full bg-[#D30CBD] blur-[500px] md:blur-[845px] w-[800px] h-[800px] -z-10 fixed -top-[700px] -right-[700px] md:-top-96 md:-right-96"></div>
        <GreedyPigContext.Provider
          value={{
            preloadSrcList,
            setHasSound,
            hasSound,
            pigPetNames,
            openTutorial: () => setShowTutorial(true),
          }}
        >
          <Outlet />
          {showTutorial && <Tutorial onClose={closeTutorial} />}
        </GreedyPigContext.Provider>
      </main>
    </>
  );
}

export default Root;