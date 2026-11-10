import { useEffect, useId, useState } from "react";
import { HiOutlineMenu } from "react-icons/hi";
import { GoTools } from "react-icons/go";
import { Link } from "react-router-dom";
import SoundSwitch from "src/components/SoundSwitch";

function Menu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Escape closes the menu, so keyboard users are never stuck.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex flex-col items-center gap-2 text-sm w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Game menu"
        className="w-[48px] h-[48px] bg-[#D30CBD80] text-white rounded-full flex justify-center items-center hover:scale-105 active:scale-100 duration-300"
      >
        <HiOutlineMenu size={24} />
      </button>

      {open && (
        <div
          id={panelId}
          className="flex flex-col gap-2 w-full max-w-[200px] bg-[#D30CBD] md:bg-[#D30CBD40] p-2 rounded-lg"
        >
          <div className="grid grid-cols-2 gap-2 w-full">
            <Link
              to="/live-game/setup"
              className="bg-[#ffffff40] hover:bg-[#ffffff80] text-white text-xs rounded-lg flex flex-col gap-1 p-2 justify-end items-center hover:scale-105 active:scale-100 duration-300"
            >
              <GoTools size={24} aria-hidden="true" />
              Setup
            </Link>
            <SoundSwitch />
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;