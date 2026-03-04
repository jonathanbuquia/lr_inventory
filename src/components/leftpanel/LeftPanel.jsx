import { useEffect, useMemo, useState } from "react";
import "./LeftPanel.css";
import logo from "../../assets/logo.png";

const LeftPanel = ({ selectedDivision, onSelectDivision }) => {
  const [divisions, setDivisions] = useState([]);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Fetch divisions list
  useEffect(() => {
    const loadDivisions = async () => {
      try {
        const res = await fetch("/data/index.json");
        if (!res.ok) throw new Error("Failed to load /data/index.json");
        const data = await res.json();

        const list = Array.isArray(data?.divisions) ? data.divisions : [];
        setDivisions(list);

        // Auto-select first division if none selected yet
        if (!selectedDivision && list.length > 0 && typeof onSelectDivision === "function") {
          onSelectDivision(list[0]);
        }
      } catch (err) {
        console.error(err);
        setDivisions([]);
      }
    };

    loadDivisions();
    // intentionally not depending on selectedDivision to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectDivision]);

  const safeDivisions = useMemo(() => (Array.isArray(divisions) ? divisions : []), [divisions]);

  const handleSelect = (division) => {
    if (typeof onSelectDivision === "function") onSelectDivision(division);
    setIsOpenMobile(false);
  };

  return (
    <>
      {isOpenMobile && (
        <button
          className="lp__overlay"
          onClick={() => setIsOpenMobile(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside className={`lp__sidebar ${isOpenMobile ? "is-open" : ""}`}>
        <div className="lp__top">
          <div className="lp__logo">
            <img src={logo} alt="LR Inventory Logo" className="lp__logoImg" />

            <div className="lp__logoText">
              <div className="lp__logoTitle">LR Inventory</div>
              <div className="lp__logoSub">Dashboard</div>
              <div>Last Updated: March 3,2026</div>
            </div>
          </div>

          <button
            className="lp__hamburger"
            onClick={() => setIsOpenMobile((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav className="lp__nav" aria-label="Divisions">
          <div className="lp__navTitle">Divisions</div>

          <div className="lp__btnList">
            {safeDivisions.length === 0 ? (
              <div className="lp__empty">No divisions loaded yet.</div>
            ) : (
              safeDivisions.map((d) => {
                const slug = d?.slug ?? "";
                const name = d?.name ?? slug;

                const selectedSlug = selectedDivision?.slug ?? "";
                const isActive = selectedSlug === slug;

                return (
                  <button
                    key={slug}
                    className={`lp__btn ${isActive ? "is-active" : ""}`}
                    onClick={() => handleSelect(d)}
                    title={name}
                  >
                    <span className="lp__btnText">{name}</span>
                  </button>
                );
              })
            )}
          </div>
        </nav>
      </aside>
    </>
  );
};

export default LeftPanel;