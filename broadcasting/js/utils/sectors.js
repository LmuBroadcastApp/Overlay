/**
 * @file Helpers for converting track distances into sector progress bars.
 */

/**
 * Stores track sector boundaries and computes progress inside each sector.
 */
class TrackSectors
{
    /**
     * Creates the sector helper with no valid track data yet.
     */
    constructor()
    {
        this.trackDistance = -1;
        this.s1 = null; this.s2 = null; this.s3 = null;
    }

    /**
     * Resets all stored sector definitions.
     */
    reset()
    {
        this.trackDistance = -1;
        this.s1 = null; this.s2 = null; this.s3 = null;
    }

    /**
     * Sets the total track distance.
     *
     * @param {number} trackDistance Track length in meters.
     */
    setTrackDistance(trackDistance)
    {
        this.trackDistance = trackDistance;
    }

    /**
     * Sets the absolute sector boundary distances.
     *
     * @param {number} s1 Sector 1 start distance.
     * @param {number} s2 Sector 2 start distance.
     * @param {number} s3 Sector 3 start distance.
     */
    setSectors(s1, s2, s3)
    {
        this.s1 = s1; this.s2 = s2; this.s3 = s3;
    }

    /**
     * Returns whether the helper has a complete valid track/sector definition.
     *
     * @returns {boolean} True when all sector values are usable.
     */
    isValid()
    {
        if(this.s1 === null || this.s2 === null || this.s3 === null) return false;
        return this.s1.distance >= 0 && this.s2.distance > 0 && this.s3.distance > 0 && this.trackDistance > 0;
    }

    /**
     * Converts a traveled distance into per-sector fill percentages.
     *
     * @param {number} distance Vehicle distance around the lap.
     * @returns {{progress:number[], active:boolean[]}} Progress and activation per sector.
     */
    getSectorProgress(distance)
    {
        if (!this.isValid())
        {
            return { progress: [0, 0, 0], active: [false, false, false] };
        }

        let s1Len = this.s2.distance   - this.s1.distance;
        let s2Len = this.s3.distance   - this.s2.distance;
        let s3Len = this.trackDistance - this.s3.distance;

        let p1 = distance >= this.s1.distance ? Math.min(1, (distance - this.s1.distance) / s1Len) : 0;
        let p2 = distance >= this.s2.distance ? Math.min(1, (distance - this.s2.distance) / s2Len) : 0;
        let p3 = distance >= this.s3.distance ? Math.min(1, (distance - this.s3.distance) / s3Len) : 0;

        let a1 = distance >= this.s1.distance;
        let a2 = distance >= this.s2.distance;
        let a3 = distance >= this.s3.distance;

        return { progress: [p1, p2, p3], active: [a1, a2, a3] };
    }
}
