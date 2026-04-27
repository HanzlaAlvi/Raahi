import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 20,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    scrollContainer: {
        paddingBottom: 30,
        flexGrow: 1,
    },
    profileSection: {
        alignItems: 'center',
        padding: 25,
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 25,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    imageContainer: {
        position: 'relative',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    image: {
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 5,
        borderColor: '#A1D826',
        backgroundColor: '#f8f9fa',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#A1D826',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    name: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 6,
        textAlign: 'center',
    },
    role: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: '500',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(161, 216, 38, 0.3)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoGrid: {
        padding: 20,
        paddingTop: 10,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    infoCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 18,
        marginHorizontal: 6,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#f8f9fa',
        minHeight: 100,
        justifyContent: 'space-between',
    },
    fullWidthCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#f8f9fa',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f0f9e8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7f8c8d',
        letterSpacing: 0.3,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#2c3e50',
        lineHeight: 22,
    },
    actionsSection: {
        padding: 20,
        paddingTop: 10,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 20,
        marginLeft: 8,
        letterSpacing: 0.5,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    actionButton: {
        width: '48%',
        alignItems: 'center',
        marginBottom: 20,
    },
    actionGradient: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2c3e50',
        textAlign: 'center',
        letterSpacing: 0.3,
    },

    // Additional styles for different states
    completedStatus: {
        backgroundColor: 'rgba(161, 216, 38, 0.1)',
        borderColor: 'rgba(161, 216, 38, 0.3)',
    },
    cancelledStatus: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    pendingStatus: {
        backgroundColor: 'rgba(255, 165, 0, 0.1)',
        borderColor: 'rgba(255, 165, 0, 0.3)',
    },

    // Responsive styles
    responsiveCard: {
        maxWidth: width > 400 ? '48%' : '100%',
    },
    responsiveImage: {
        width: width > 400 ? 130 : 110,
        height: width > 400 ? 130 : 110,
        borderRadius: width > 400 ? 65 : 55,
    },

    // Loading states
    skeletonContainer: {
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
    },
    skeletonText: {
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        height: 16,
        marginBottom: 8,
    },

    // Animation styles
    fadeIn: {
        opacity: 0,
        transform: [{ translateY: 20 }],
    },
    fadeInActive: {
        opacity: 1,
        transform: [{ translateY: 0 }],
    },
});

// Additional style utilities
export const profileStyles = {
    // Color variants
    colors: {
        primary: '#A1D826',
        primaryDark: '#8BC220',
        success: '#A1D826',
        danger: '#FF6B6B',
        warning: '#FFA500',
        info: '#3498db',
        light: '#f8f9fa',
        dark: '#2c3e50',
        gray: '#7f8c8d',
    },
    
    // Typography scale
    typography: {
        h1: {
            fontSize: 26,
            fontWeight: 'bold',
            color: '#2c3e50',
        },
        h2: {
            fontSize: 22,
            fontWeight: 'bold',
            color: '#2c3e50',
        },
        h3: {
            fontSize: 18,
            fontWeight: '600',
            color: '#2c3e50',
        },
        body: {
            fontSize: 16,
            color: '#7f8c8d',
        },
        caption: {
            fontSize: 14,
            color: '#95a5a6',
        },
    },
    
    // Spacing scale
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 40,
    },
    
    // Border radius scale
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        xxl: 25,
        round: 50,
    },
};