import { useEffect, useMemo, useState } from "react";
import "./LeftPanel.css";
import logo from "../../assets/logo.png";

import { LAST_UPDATED } from "../../lastUpdated";

const LeftPanel = ({
  selectedDivision,
  onSelectDivision,
}) => {
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
      } catch (err) {
        console.error(err);
        setDivisions([]);
      }
    };

    loadDivisions();
  }, []);

  const safeDivisions = useMemo(() => (Array.isArray(divisions) ? divisions : []), [divisions]);

  const handleSelect = (division) => {
    if (typeof onSelectDivision === "function") onSelectDivision(division);
    setIsOpenMobile(false);
  };

  const [updatedDate, updatedTime] = (() => {
    const match = LAST_UPDATED.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (!match) return [LAST_UPDATED, ""];
    return [match[1], match[2]];
  })();

  return (
    <>
      <button
        type="button"
        className={`lp__mobileToggle ${isOpenMobile ? "is-open" : ""}`}
        onClick={() => setIsOpenMobile((v) => !v)}
        aria-label={isOpenMobile ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isOpenMobile}
        aria-controls="division-sidebar"
      >
        <span />
        <span />
        <span />
      </button>

      {isOpenMobile && (
        <button
          className="lp__overlay"
          onClick={() => setIsOpenMobile(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        id="division-sidebar"
        className={`lp__sidebar ${isOpenMobile ? "is-open" : ""}`}
      >
        <div className="lp__top">
          <div className="lp__logo">
            <img src={logo} alt="LR Regional Inventory Logo" className="lp__logoImg" />

            <div className="lp__logoText">
              <div className="lp__logoTitle">LR Regional Inventory</div>
              <div className="lp__logoSub">Dashboard</div>
              <div className="lp__updates">
                <div>Last Updated: {updatedDate}</div>
                {updatedTime ? <div>{updatedTime}</div> : null}
              </div>
            </div>
          </div>

          <button
            type="button"
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
