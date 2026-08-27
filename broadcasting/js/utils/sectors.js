class TrackSectors
{
    constructor()
    {
        this.trackDistance = -1;
        this.s1 = -1; this.s2 = -1; this.s3 = -1;
    }

    reset()
    {
        this.trackDistance = -1;
        this.s1 = -1; this.s2 = -1; this.s3 = -1;
    }

    setTrackDistance(trackDistance)
    {
        this.trackDistance = trackDistance;
    }

    setSectors(s1, s2, s3)
    {
        this.s1 = s1; this.s2 = s2; this.s3 = s3;
    }

    isValid()
    {
        return this.s1 >= 0 && this.s2 > 0 && this.s3 > 0 && this.trackDistance > 0;
    }

    getSectorProgress(distance)
    {
        if (!this.isValid())
        {
            return { progress: [0, 0, 0], active: [false, false, false] };
        }

        let s1Len = this.s2 - this.s1;
        let s2Len = this.s3 - this.s2;
        let s3Len = this.trackDistance - this.s3;

        let p1 = distance >= this.s1 ? Math.min(1, (distance - this.s1) / s1Len) : 0;
        let p2 = distance >= this.s2 ? Math.min(1, (distance - this.s2) / s2Len) : 0;
        let p3 = distance >= this.s3 ? Math.min(1, (distance - this.s3) / s3Len) : 0;

        let a1 = distance >= this.s1;
        let a2 = distance >= this.s2;
        let a3 = distance >= this.s3;

        return { progress: [p1, p2, p3], active: [a1, a2, a3] };
    }
}
