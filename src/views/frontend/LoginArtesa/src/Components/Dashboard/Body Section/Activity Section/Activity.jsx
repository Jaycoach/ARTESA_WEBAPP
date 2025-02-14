import React from "react";
import './Activity.css';

const Activity = () => {
    return (
        <div className="activity">
            <div className="activity-header">
                <h1>Activity</h1>
            </div>
            <div className="activity-content">
                <div className="activity-card">
                    <h2>Today</h2>
                    <p>Nothing to show here</p>
                </div>
                <div className="activity-card">
                    <h2>Yesterday</h2>
                    <p>Nothing to show here</p>
                </div>
                <div className="activity-card">
                    <h2>Last Week</h2>
                    <p>Nothing to show here</p>
                </div>
            </div>
        </div>
    );
}

export default Activity;