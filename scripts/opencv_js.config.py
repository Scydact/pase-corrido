# The only OpenCV functions compiled into the app's build. Everything else is left out to
# keep the download small, so a new cv.something call needs adding here, then
# `npm run build:opencv`.

core = {
    '': [],
    'Algorithm': [],
}

imgproc = {
    '': [
        # Used by src/vision/detect.ts
        'Canny',
        'GaussianBlur',
        'connectedComponentsWithStats',
        'contourArea',
        'cvtColor',
        'dilate',
        'findContours',
        'getPerspectiveTransform',
        'getStructuringElement',
        'minAreaRect',
        'morphologyEx',
        'threshold',
        'warpPerspective',
        # Used by src/vision/detect.test.ts to draw test scenes
        'circle',
        'getRotationMatrix2D',
        'line',
        'rectangle',
        'warpAffine',
    ],
}

white_list = makeWhiteList([core, imgproc])
