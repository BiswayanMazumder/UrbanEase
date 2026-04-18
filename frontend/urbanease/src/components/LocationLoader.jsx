export default function LocationLoader() {
  return (
    <>
      <div className="loader-wrapper">
        <div className="loader-box">
          <div className="logo">
            <div className="logo-icon">UE</div>
            <span>UrbanEase</span>
          </div>

          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      </div>

      {/* Inline CSS */}
      <style>{`
        .loader-wrapper {
          height: 90vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f5f5f5;
        }

        .loader-box {
          text-align: center;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .logo-icon {
          background: black;
          color: white;
          font-weight: bold;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 14px;
        }

        .logo span {
          font-size: 18px;
          font-weight: 500;
          color: #222;
        }

        .progress-bar {
          width: 220px;
          height: 4px;
          background: #ddd;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          width: 30%;
          height: 100%;
          background: #6c4cff;
          position: absolute;
          left: -30%;
          animation: slide 1.2s ease-in-out infinite;
        }

        @keyframes slide {
          0% {
            left: -30%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
}