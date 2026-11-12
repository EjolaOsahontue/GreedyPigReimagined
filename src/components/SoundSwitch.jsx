import { AiFillSound } from "react-icons/ai";
import { BiVolumeMute } from "react-icons/bi";
import { useGreedyPigContext } from "src/context/useGreedyPigContext";

function SoundSwitch() {
  const { setHasSound, hasSound } = useGreedyPigContext();
  return (
    <button
      type="button"
      onClick={() => setHasSound(!hasSound)}
      className={`flex flex-col items-center justify-end gap-1 p-2 text-xs text-white rounded-lg hover:scale-105 active:scale-100 duration-300 ${
        hasSound ? "bg-[#ffffff40] hover:bg-[#ffffff80]" : "bg-[#D30C0C80] hover:bg-[#D30C0C]"
      }`}
    >
      {hasSound ? (
        <AiFillSound size={24} aria-hidden="true" />
      ) : (
        <BiVolumeMute size={24} aria-hidden="true" />
      )}
      <span>{hasSound ? "Sound on" : "Sound off"}</span>
    </button>
  );
}

export default SoundSwitch;